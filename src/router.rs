//! Transport-agnostic request routing.
//!
//! [`route`] takes a plain [`Req`] and returns a plain [`Resp`]; it never touches
//! a socket. `src/main.rs` adapts `tiny_http` requests to this shape, and the
//! tests call [`route`] directly.
//!
//! There is no login/auth layer: this app is meant to run on a trusted home
//! network for two people, and anyone who can reach it can both view and edit.

use std::sync::Mutex;

use rusqlite::Connection;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::config::Config;
use crate::db;

/// Shared application state: the database and configuration.
pub struct App {
    pub db: Mutex<Connection>,
    pub config: Config,
}

impl App {
    /// Open the configured database, create tables, and assemble the state.
    pub fn new(config: Config) -> rusqlite::Result<App> {
        let conn = db::open(&config.db_path)?;
        db::init(&conn)?;
        Ok(App {
            db: Mutex::new(conn),
            config,
        })
    }
}

/// A normalized inbound request.
pub struct Req<'a> {
    pub method: &'a str,
    /// Path only, without the query string.
    pub path: &'a str,
    pub body: Vec<u8>,
}

/// A response ready to be written to any transport.
pub struct Resp {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

impl Resp {
    fn json(status: u16, value: Value) -> Resp {
        Resp {
            status,
            headers: vec![("Content-Type".into(), "application/json".into())],
            body: value.to_string().into_bytes(),
        }
    }

    fn empty(status: u16) -> Resp {
        Resp {
            status,
            headers: Vec::new(),
            body: Vec::new(),
        }
    }

    fn text(status: u16, message: &str) -> Resp {
        Resp {
            status,
            headers: vec![("Content-Type".into(), "text/plain; charset=utf-8".into())],
            body: message.as_bytes().to_vec(),
        }
    }
}

/// Dispatch one request.
pub fn route(app: &App, req: &Req) -> Resp {
    match (req.method, req.path) {
        ("GET", "/") => serve_static(app, "index.html"),
        ("GET", p) if p.starts_with("/web/") => serve_static(app, &p["/web/".len()..]),
        ("GET", "/api/snapshot") => snapshot(app),
        ("POST", "/api/visits") => visits(app, req),
        ("POST", "/api/pins") => pins_create(app, req),
        ("DELETE", p) if p.starts_with("/api/pins/") => {
            pins_delete(app, &p["/api/pins/".len()..])
        }
        ("OPTIONS", _) => Resp::empty(204),
        _ => Resp::text(404, "not found"),
    }
}

// --- handlers ---------------------------------------------------------------

fn snapshot(app: &App) -> Resp {
    let conn = app.db.lock().unwrap();
    let me = db::list_visits(&conn, "me").unwrap_or_default();
    let partner = db::list_visits(&conn, "partner").unwrap_or_default();
    let pins = db::list_pins(&conn).unwrap_or_default();
    Resp::json(
        200,
        json!({
            "names": { "me": app.config.name_me, "partner": app.config.name_partner },
            "visits": { "me": me, "partner": partner },
            "pins": pins,
        }),
    )
}

#[derive(Deserialize)]
struct VisitBody {
    profile: String,
    state_code: String,
    visited: bool,
}

fn visits(app: &App, req: &Req) -> Resp {
    let Ok(body) = serde_json::from_slice::<VisitBody>(&req.body) else {
        return Resp::text(400, "bad request body");
    };
    if !is_profile(&body.profile) {
        return Resp::text(422, "profile must be \"me\" or \"partner\"");
    }
    let Some(code) = normalize_state(&body.state_code) else {
        return Resp::text(422, "state_code must be a two-letter code");
    };

    let conn = app.db.lock().unwrap();
    let result = if body.visited {
        db::set_visit(&conn, &body.profile, &code)
    } else {
        db::clear_visit(&conn, &body.profile, &code)
    };
    match result {
        Ok(()) => Resp::empty(204),
        Err(_) => Resp::text(500, "database error"),
    }
}

#[derive(Deserialize)]
struct PinBody {
    profile: String,
    x: f64,
    y: f64,
    #[serde(default)]
    label: String,
}

fn pins_create(app: &App, req: &Req) -> Resp {
    let Ok(body) = serde_json::from_slice::<PinBody>(&req.body) else {
        return Resp::text(400, "bad request body");
    };
    if !is_profile(&body.profile) {
        return Resp::text(422, "profile must be \"me\" or \"partner\"");
    }
    if !(0.0..=1.0).contains(&body.x) || !(0.0..=1.0).contains(&body.y) {
        return Resp::text(422, "x and y must be between 0 and 1");
    }
    let label: String = body.label.trim().chars().take(80).collect();

    let conn = app.db.lock().unwrap();
    match db::add_pin(&conn, &body.profile, body.x, body.y, &label) {
        Ok(id) => Resp::json(200, json!({ "id": id })),
        Err(_) => Resp::text(500, "database error"),
    }
}

fn pins_delete(app: &App, id_str: &str) -> Resp {
    let Ok(id) = id_str.parse::<i64>() else {
        return Resp::text(400, "pin id must be an integer");
    };
    let conn = app.db.lock().unwrap();
    match db::delete_pin(&conn, id) {
        Ok(()) => Resp::empty(204),
        Err(_) => Resp::text(500, "database error"),
    }
}

// --- static files ---------------------------------------------------------

fn serve_static(app: &App, name: &str) -> Resp {
    // `name` must be a single, boring filename: no directories, no traversal.
    let safe = !name.is_empty()
        && !name.contains('/')
        && !name.contains('\\')
        && !name.contains("..")
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'));
    if !safe {
        return Resp::text(404, "not found");
    }
    match std::fs::read(app.config.web_dir.join(name)) {
        Ok(bytes) => Resp {
            status: 200,
            headers: vec![("Content-Type".into(), content_type(name).into())],
            body: bytes,
        },
        Err(_) => Resp::text(404, "not found"),
    }
}

fn content_type(name: &str) -> &'static str {
    match name.rsplit('.').next().unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" => "text/javascript; charset=utf-8",
        "svg" => "image/svg+xml",
        "json" => "application/json",
        "ico" => "image/x-icon",
        _ => "application/octet-stream",
    }
}

// --- helpers ------------------------------------------------------------------

fn is_profile(value: &str) -> bool {
    value == "me" || value == "partner"
}

/// Lowercase and validate a two-letter US state / DC code.
fn normalize_state(raw: &str) -> Option<String> {
    let code = raw.trim().to_ascii_lowercase();
    (code.len() == 2 && code.bytes().all(|b| b.is_ascii_lowercase())).then_some(code)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn test_app() -> App {
        let conn = db::open_memory().unwrap();
        db::init(&conn).unwrap();
        App {
            db: Mutex::new(conn),
            config: Config {
                addr: "127.0.0.1:0".into(),
                name_me: "Ada".into(),
                name_partner: "Bo".into(),
                web_dir: PathBuf::from("web"),
                db_path: PathBuf::from(":memory:"),
            },
        }
    }

    fn req<'a>(method: &'a str, path: &'a str, body: &str) -> Req<'a> {
        Req {
            method,
            path,
            body: body.as_bytes().to_vec(),
        }
    }

    #[test]
    fn snapshot_is_public_and_has_names() {
        let app = test_app();
        let r = route(&app, &req("GET", "/api/snapshot", ""));
        assert_eq!(r.status, 200);
        let body: Value = serde_json::from_slice(&r.body).unwrap();
        assert_eq!(body["names"]["me"], "Ada");
        assert_eq!(body["visits"]["partner"].as_array().unwrap().len(), 0);
    }

    #[test]
    fn full_flow_visit_pin_no_auth_needed() {
        let app = test_app();

        // record a visit (uppercase code is accepted and normalized)
        let r = route(
            &app,
            &req(
                "POST",
                "/api/visits",
                r#"{"profile":"me","state_code":"CA","visited":true}"#,
            ),
        );
        assert_eq!(r.status, 204);

        let r = route(&app, &req("GET", "/api/snapshot", ""));
        let body: Value = serde_json::from_slice(&r.body).unwrap();
        assert_eq!(body["visits"]["me"][0], "ca");

        // add then delete a pin
        let r = route(
            &app,
            &req(
                "POST",
                "/api/pins",
                r#"{"profile":"partner","x":0.3,"y":0.42,"label":"  Rocky Mountain NP  "}"#,
            ),
        );
        assert_eq!(r.status, 200);
        let id = serde_json::from_slice::<Value>(&r.body).unwrap()["id"]
            .as_i64()
            .unwrap();

        let r = route(&app, &req("GET", "/api/snapshot", ""));
        let body: Value = serde_json::from_slice(&r.body).unwrap();
        assert_eq!(body["pins"][0]["label"], "Rocky Mountain NP");
        assert_eq!(body["pins"][0]["profile"], "partner");

        let path = format!("/api/pins/{id}");
        let r = route(&app, &req("DELETE", &path, ""));
        assert_eq!(r.status, 204);

        let r = route(&app, &req("GET", "/api/snapshot", ""));
        let body: Value = serde_json::from_slice(&r.body).unwrap();
        assert_eq!(body["pins"].as_array().unwrap().len(), 0);
    }

    #[test]
    fn bad_profile_and_state_are_422() {
        let app = test_app();
        let r = route(
            &app,
            &req(
                "POST",
                "/api/visits",
                r#"{"profile":"someone","state_code":"ca","visited":true}"#,
            ),
        );
        assert_eq!(r.status, 422);

        let r = route(
            &app,
            &req(
                "POST",
                "/api/visits",
                r#"{"profile":"me","state_code":"california","visited":true}"#,
            ),
        );
        assert_eq!(r.status, 422);
    }

    #[test]
    fn pin_coordinates_must_be_normalized() {
        let app = test_app();
        let r = route(
            &app,
            &req(
                "POST",
                "/api/pins",
                r#"{"profile":"me","x":42.0,"y":0.5,"label":"nope"}"#,
            ),
        );
        assert_eq!(r.status, 422);
    }

    #[test]
    fn static_paths_reject_traversal() {
        let app = test_app();
        let r = route(&app, &req("GET", "/web/../Cargo.toml", ""));
        assert_eq!(r.status, 404);
    }
}

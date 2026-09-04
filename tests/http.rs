//! End-to-end check: start the real `tiny_http` server on an ephemeral port and
//! drive it with a hand-rolled HTTP/1.1 client (no HTTP client crate).

use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use travelmap::config::Config;
use travelmap::db;
use travelmap::router::App;

fn start_server() -> SocketAddr {
    let conn = db::open_memory().unwrap();
    db::init(&conn).unwrap();
    let app = Arc::new(App {
        db: Mutex::new(conn),
        config: Config {
            addr: "127.0.0.1:0".into(),
            name_me: "Ada".into(),
            name_partner: "Bo".into(),
            web_dir: "web".into(),
            db_path: ":memory:".into(),
        },
    });

    let server = Arc::new(tiny_http::Server::http("127.0.0.1:0").unwrap());
    let addr = server.server_addr().to_ip().unwrap();
    thread::spawn(move || travelmap::server::serve(app, server, 2));
    addr
}

struct HttpResponse {
    status: u16,
    body: String,
}

/// Send one request over a fresh connection and read the whole response.
fn send(addr: SocketAddr, method: &str, path: &str, body: Option<&str>) -> HttpResponse {
    let mut stream = TcpStream::connect(addr).unwrap();
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .unwrap();

    let body = body.unwrap_or("");
    let req = format!(
        "{method} {path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\
         Content-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}",
        body.len()
    );

    stream.write_all(req.as_bytes()).unwrap();
    let mut raw = Vec::new();
    stream.read_to_end(&mut raw).unwrap();
    let text = String::from_utf8_lossy(&raw).into_owned();

    let (head, body) = text.split_once("\r\n\r\n").unwrap_or((text.as_str(), ""));
    let status = head
        .lines()
        .next()
        .and_then(|l| l.split_whitespace().nth(1))
        .and_then(|s| s.parse().ok())
        .expect("status line");
    HttpResponse {
        status,
        body: body.to_string(),
    }
}

#[test]
fn end_to_end_through_the_real_server() {
    let addr = start_server();

    // the homepage is served from web/index.html
    let home = send(addr, "GET", "/", None);
    assert_eq!(home.status, 200);
    assert!(home.body.to_lowercase().contains("<!doctype html"));

    // snapshot is public
    let snap = send(addr, "GET", "/api/snapshot", None);
    assert_eq!(snap.status, 200);
    assert!(snap.body.contains("\"visits\""));

    // no login needed: record a visit straight away, then see it in the snapshot
    let recorded = send(
        addr,
        "POST",
        "/api/visits",
        Some(r#"{"profile":"me","state_code":"CA","visited":true}"#),
    );
    assert_eq!(recorded.status, 204);

    let snap = send(addr, "GET", "/api/snapshot", None);
    assert!(snap.body.contains("\"ca\""));

    // add a pin, then delete it
    let pin = send(
        addr,
        "POST",
        "/api/pins",
        Some(r#"{"profile":"partner","x":0.5,"y":0.5,"label":"Zion"}"#),
    );
    assert_eq!(pin.status, 200);
    let id: i64 = serde_json::from_str::<serde_json::Value>(&pin.body).unwrap()["id"]
        .as_i64()
        .unwrap();

    let deleted = send(addr, "DELETE", &format!("/api/pins/{id}"), None);
    assert_eq!(deleted.status, 204);

    // locking blocks further edits but not the snapshot or unlocking
    let locked = send(addr, "POST", "/api/lock", Some(r#"{"locked":true}"#));
    assert_eq!(locked.status, 204);

    let snap = send(addr, "GET", "/api/snapshot", None);
    assert!(snap.body.contains("\"locked\":true"));

    let blocked = send(
        addr,
        "POST",
        "/api/visits",
        Some(r#"{"profile":"me","state_code":"ny","visited":true}"#),
    );
    assert_eq!(blocked.status, 423);

    let unlocked = send(addr, "POST", "/api/lock", Some(r#"{"locked":false}"#));
    assert_eq!(unlocked.status, 204);
}

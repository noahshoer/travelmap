//! SQLite storage: schema plus every query the app needs.
//!
//! Two tables. `state_visits` has one row per (profile, state) pair a person has
//! marked visited. `pins` holds free-form labeled markers placed by clicking the
//! map, stored as normalized 0..1 coordinates in the SVG's viewBox.
//!
//! "Both visited" is never stored — it is [`both_visited`], derived on demand.

use std::path::Path;

use rusqlite::{params, Connection, Result};
use serde::Serialize;

/// A labeled map marker.
#[derive(Serialize, Debug, PartialEq)]
pub struct Pin {
    pub id: i64,
    pub profile: String,
    /// Normalized x in `0.0..=1.0` (fraction of viewBox width).
    pub x: f64,
    /// Normalized y in `0.0..=1.0` (fraction of viewBox height).
    pub y: f64,
    pub label: String,
}

/// Open (creating if needed) the database file, making parent directories first.
pub fn open(path: &Path) -> Result<Connection> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            let _ = std::fs::create_dir_all(parent);
        }
    }
    Connection::open(path)
}

/// Open an in-memory database (used by tests).
pub fn open_memory() -> Result<Connection> {
    Connection::open_in_memory()
}

/// Create the tables if they do not already exist. Safe to call on every start.
pub fn init(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS state_visits (
             profile    TEXT NOT NULL,
             state_code TEXT NOT NULL,
             visited_at TEXT NOT NULL,
             PRIMARY KEY (profile, state_code)
         );
         CREATE TABLE IF NOT EXISTS pins (
             id         INTEGER PRIMARY KEY,
             profile    TEXT NOT NULL,
             x          REAL NOT NULL,
             y          REAL NOT NULL,
             label      TEXT NOT NULL DEFAULT '',
             created_at TEXT NOT NULL
         );",
    )
}

/// Seconds since the Unix epoch as a string. Avoids pulling in a date crate;
/// the value is only ever used as an opaque "when recorded" stamp.
fn now() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

/// Mark `state` visited by `profile`. Idempotent: a repeat call is a no-op and
/// keeps the original timestamp.
pub fn set_visit(conn: &Connection, profile: &str, state: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO state_visits (profile, state_code, visited_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(profile, state_code) DO NOTHING",
        params![profile, state, now()],
    )?;
    Ok(())
}

/// Remove a visit. No error if the row was not there.
pub fn clear_visit(conn: &Connection, profile: &str, state: &str) -> Result<()> {
    conn.execute(
        "DELETE FROM state_visits WHERE profile = ?1 AND state_code = ?2",
        params![profile, state],
    )?;
    Ok(())
}

/// Every state code `profile` has visited, ascending.
pub fn list_visits(conn: &Connection, profile: &str) -> Result<Vec<String>> {
    let mut stmt =
        conn.prepare("SELECT state_code FROM state_visits WHERE profile = ?1 ORDER BY state_code")?;
    let rows = stmt.query_map(params![profile], |r| r.get::<_, String>(0))?;
    rows.collect()
}

/// State codes visited by two distinct profiles (i.e. both people).
pub fn both_visited(conn: &Connection) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT state_code FROM state_visits
         GROUP BY state_code HAVING COUNT(DISTINCT profile) = 2
         ORDER BY state_code",
    )?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
    rows.collect()
}

/// Insert a pin, returning its new id.
pub fn add_pin(conn: &Connection, profile: &str, x: f64, y: f64, label: &str) -> Result<i64> {
    conn.execute(
        "INSERT INTO pins (profile, x, y, label, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![profile, x, y, label, now()],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Delete a pin by id. No error if it does not exist.
pub fn delete_pin(conn: &Connection, id: i64) -> Result<()> {
    conn.execute("DELETE FROM pins WHERE id = ?1", params![id])?;
    Ok(())
}

/// All pins, ascending by id.
pub fn list_pins(conn: &Connection) -> Result<Vec<Pin>> {
    let mut stmt = conn.prepare("SELECT id, profile, x, y, label FROM pins ORDER BY id")?;
    let rows = stmt.query_map([], |r| {
        Ok(Pin {
            id: r.get(0)?,
            profile: r.get(1)?,
            x: r.get(2)?,
            y: r.get(3)?,
            label: r.get(4)?,
        })
    })?;
    rows.collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn db() -> Connection {
        let c = open_memory().unwrap();
        init(&c).unwrap();
        c
    }

    #[test]
    fn visit_upsert_is_idempotent() {
        let c = db();
        set_visit(&c, "me", "ca").unwrap();
        set_visit(&c, "me", "ca").unwrap();
        assert_eq!(list_visits(&c, "me").unwrap(), vec!["ca"]);
    }

    #[test]
    fn clear_visit_removes_the_row() {
        let c = db();
        set_visit(&c, "me", "ny").unwrap();
        clear_visit(&c, "me", "ny").unwrap();
        assert!(list_visits(&c, "me").unwrap().is_empty());
        // clearing again is harmless
        clear_visit(&c, "me", "ny").unwrap();
    }

    #[test]
    fn both_visited_requires_two_profiles() {
        let c = db();
        set_visit(&c, "me", "nv").unwrap();
        set_visit(&c, "me", "ut").unwrap();
        set_visit(&c, "partner", "nv").unwrap();
        set_visit(&c, "partner", "az").unwrap();
        // only NV was visited by both
        assert_eq!(both_visited(&c).unwrap(), vec!["nv"]);
    }

    #[test]
    fn pin_round_trip() {
        let c = db();
        let id = add_pin(&c, "me", 0.5, 0.4, "Seattle").unwrap();
        let pins = list_pins(&c).unwrap();
        assert_eq!(pins.len(), 1);
        assert_eq!(pins[0].label, "Seattle");
        assert_eq!(pins[0].profile, "me");
        delete_pin(&c, id).unwrap();
        assert!(list_pins(&c).unwrap().is_empty());
    }
}

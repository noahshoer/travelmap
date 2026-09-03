//! Runtime configuration.
//!
//! Every setting can be supplied by an environment variable or by a line in a
//! `travelmap.toml` file in the working directory (a tiny hand-rolled
//! `key = "value"` reader — no `toml` crate). Environment variables win over the
//! file. Everything has a sensible default, so this never fails to load.

use std::collections::HashMap;
use std::path::PathBuf;

/// Fully resolved configuration for one server run.
pub struct Config {
    /// Address to bind, e.g. `0.0.0.0:8080`.
    pub addr: String,
    /// Display name for the `me` profile.
    pub name_me: String,
    /// Display name for the `partner` profile.
    pub name_partner: String,
    /// Directory the static frontend files are served from.
    pub web_dir: PathBuf,
    /// Path to the SQLite database file.
    pub db_path: PathBuf,
}

impl Config {
    /// Build a [`Config`] from the environment and an optional `travelmap.toml`.
    pub fn from_env() -> Config {
        let file = load_file("travelmap.toml");
        let get = |key: &str| -> Option<String> {
            std::env::var(key)
                .ok()
                .or_else(|| file.get(key).cloned())
                .filter(|s| !s.is_empty())
        };

        Config {
            addr: get("TRAVELMAP_ADDR").unwrap_or_else(|| "0.0.0.0:8080".into()),
            name_me: get("TRAVELMAP_ME").unwrap_or_else(|| "Me".into()),
            name_partner: get("TRAVELMAP_PARTNER").unwrap_or_else(|| "Partner".into()),
            web_dir: get("TRAVELMAP_WEB_DIR")
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("web")),
            db_path: get("TRAVELMAP_DB")
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from("data/travelmap.db")),
        }
    }
}

/// Parse a minimal `key = "value"` file. Missing file -> empty map. Blank lines
/// and lines starting with `#` are ignored; surrounding quotes are stripped.
fn load_file(path: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    let Ok(text) = std::fs::read_to_string(path) else {
        return map;
    };
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some((k, v)) = line.split_once('=') {
            let v = v.trim().trim_matches(['"', '\'']);
            map.insert(k.trim().to_string(), v.to_string());
        }
    }
    map
}

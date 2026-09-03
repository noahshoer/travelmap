//! TravelMap — a small private web app for two people to record which US states
//! each of them has visited, drop labeled pins, and see where their travels
//! overlap.
//!
//! The crate is split into a library (this file and its modules) and a thin
//! binary (`src/main.rs`). Request handling lives in the library as the
//! transport-agnostic [`router::route`] function, so the tests can exercise the
//! full request/response logic without opening a socket. [`server`] is the only
//! part that knows about `tiny_http`.
//!
//! There is no login/auth layer — see [`router`] for why.

pub mod config;
pub mod db;
pub mod router;
pub mod server;

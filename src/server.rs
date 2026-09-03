//! Glue between `tiny_http` and the transport-agnostic [`crate::router`].
//!
//! [`handle`] converts a single `tiny_http::Request` into a [`Req`], runs
//! [`route`], and writes the [`Resp`] back. [`serve`] just runs a pool of worker
//! threads that each pull requests off one shared server and call [`handle`].

use std::sync::Arc;
use std::thread;

use crate::router::{route, App, Req};

/// Run `workers` threads accepting from `server` until it stops, then return.
pub fn serve(app: Arc<App>, server: Arc<tiny_http::Server>, workers: usize) {
    let mut handles = Vec::with_capacity(workers);
    for _ in 0..workers.max(1) {
        let app = Arc::clone(&app);
        let server = Arc::clone(&server);
        handles.push(thread::spawn(move || {
            for request in server.incoming_requests() {
                handle(&app, request);
            }
        }));
    }
    for h in handles {
        let _ = h.join();
    }
}

/// Handle exactly one request.
pub fn handle(app: &App, mut request: tiny_http::Request) {
    let method = request.method().as_str().to_string();
    let url = request.url().to_string();
    let path = url.split('?').next().unwrap_or("/").to_string();

    let mut body = Vec::new();
    let _ = request.as_reader().read_to_end(&mut body);

    let resp = route(
        app,
        &Req {
            method: &method,
            path: &path,
            body,
        },
    );

    let mut response = tiny_http::Response::from_data(resp.body).with_status_code(resp.status);
    for (key, value) in resp.headers {
        if let Ok(header) = tiny_http::Header::from_bytes(key.as_bytes(), value.as_bytes()) {
            response.add_header(header);
        }
    }
    let _ = request.respond(response);
}

//! Binary entry point: load config, open the database, bind the port, and hand
//! off to [`travelmap::server::serve`].

use std::sync::Arc;

use travelmap::config::Config;
use travelmap::router::App;
use travelmap::server::serve;

fn main() {
    let config = Config::from_env();
    let addr = config.addr.clone();

    let app = Arc::new(App::new(config).unwrap_or_else(|err| {
        eprintln!("failed to open database: {err}");
        std::process::exit(1);
    }));

    let server = Arc::new(tiny_http::Server::http(&addr).unwrap_or_else(|err| {
        eprintln!("failed to bind {addr}: {err}");
        std::process::exit(1);
    }));
    println!("TravelMap listening on http://{addr}  (Ctrl+C to stop)");

    serve(app, server, 4);
}

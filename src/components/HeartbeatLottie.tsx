import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { DotLottie, DotLottieWorker } from "@lottiefiles/dotlottie-web";

// Serve the player's wasm from our own /public instead of the default CDN
// (jsdelivr/unpkg). The app runs locally/offline, so a CDN fetch would leave the
// loader blank. Set once at module load — before any instance mounts.
// DotLottieReact uses the worker variant; set both to be safe.
DotLottie.setWasmUrl("/dotlottie-player.wasm");
DotLottieWorker.setWasmUrl("/dotlottie-player.wasm");

/**
 * The actual dotLottie heartbeat player, isolated in its own module so it can be
 * lazy-loaded by HeartbeatLoader. Keeping the (heavy) Lottie player + wasm
 * binding out of the entry graph shrinks first paint — a CSS pulse stands in
 * while this chunk loads.
 */
export default function HeartbeatLottie({ size }: { size: number }) {
  return <DotLottieReact src="/heartbeat.lottie" loop autoplay style={{ width: size, height: size }} />;
}

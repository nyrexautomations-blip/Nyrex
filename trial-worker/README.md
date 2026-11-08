# Trial page Worker

Self-serve trial page for shop owners. The owner types their hours and prices and gets a live chat with their own assistant on the Nyrex bot. It only writes a `client_<id>` entry to the shared KV namespace (expires after 7 days). It does not change the live bot.

Cloudflare Worker name: `nyrex`. Set the build root directory to `trial-worker`.

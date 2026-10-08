"use strict";

// ============================================================
// NKWASIBWE IRHCF
// ROOT SERVER BOOTSTRAP
// ============================================================
//
// The production backend lives in ./backend/server.js.
// Keeping this bootstrap means Render/Node deployments that
// execute the repository root still start the real IRHCF
// backend instead of the legacy demo API.
// ============================================================

require("./backend/server.js");

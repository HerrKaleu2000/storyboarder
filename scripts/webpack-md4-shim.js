// webpack 4 hardcodes the "md4" hash algorithm, which OpenSSL 3 (Node 17+)
// no longer provides by default. Rather than relying on --openssl-legacy-provider
// (unsupported on Node <17 and rejected via NODE_OPTIONS in some Node/Electron
// builds), transparently substitute "sha256" whenever "md4" is requested.
const crypto = require("crypto")
const originalCreateHash = crypto.createHash

crypto.createHash = (algorithm, ...args) =>
  originalCreateHash(algorithm === "md4" ? "sha256" : algorithm, ...args)

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSystemMessage = isSystemMessage;
exports.isRealMessage = isRealMessage;
function isSystemMessage(payload) {
    return !!payload.t;
}
function isRealMessage(payload) {
    return !isSystemMessage(payload) && !!(payload.msg ?? "").trim();
}
//# sourceMappingURL=message-utils.js.map
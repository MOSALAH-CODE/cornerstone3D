"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class CanvasMapper {
    constructor(actor) {
        this.actor = actor;
    }
    getInputData() {
        return this.actor.getImage();
    }
}
exports.default = CanvasMapper;
//# sourceMappingURL=CanvasMapper.js.map
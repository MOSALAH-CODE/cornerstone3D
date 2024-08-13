"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class RLEVoxelMap {
    constructor(width, height, depth = 1) {
        this.rows = new Map();
        this.height = 1;
        this.width = 1;
        this.depth = 1;
        this.jMultiple = 1;
        this.kMultiple = 1;
        this.numComps = 1;
        this.defaultValue = 0;
        this.pixelDataConstructor = Uint8Array;
        this.get = (index) => {
            const i = index % this.jMultiple;
            const j = (index - i) / this.jMultiple;
            const rle = this.getRLE(i, j);
            return (rle === null || rle === void 0 ? void 0 : rle.value) || this.defaultValue;
        };
        this.getRun = (j, k) => {
            const runIndex = j + k * this.height;
            return this.rows.get(runIndex);
        };
        this.set = (index, value) => {
            if (value === undefined) {
                throw new Error(`Can't set undefined at ${index % this.width}`);
            }
            const i = index % this.width;
            const j = (index - i) / this.width;
            const row = this.rows.get(j);
            if (!row) {
                this.rows.set(j, [{ start: i, end: i + 1, value }]);
                return;
            }
            const rleIndex = this.findIndex(row, i);
            const rle1 = row[rleIndex];
            const rle0 = row[rleIndex - 1];
            if (!rle1) {
                if (!rle0 || rle0.value !== value || rle0.end !== i) {
                    row[rleIndex] = { start: i, end: i + 1, value };
                    return;
                }
                rle0.end++;
                return;
            }
            const { start, end, value: oldValue } = rle1;
            if (value === oldValue && i >= start) {
                return;
            }
            const rleInsert = { start: i, end: i + 1, value };
            const isAfter = i > start;
            const insertIndex = isAfter ? rleIndex + 1 : rleIndex;
            const rlePrev = isAfter ? rle1 : rle0;
            let rleNext = isAfter ? row[rleIndex + 1] : rle1;
            if ((rlePrev === null || rlePrev === void 0 ? void 0 : rlePrev.value) === value && (rlePrev === null || rlePrev === void 0 ? void 0 : rlePrev.end) === i) {
                rlePrev.end++;
                if ((rleNext === null || rleNext === void 0 ? void 0 : rleNext.value) === value && rleNext.start === i + 1) {
                    rlePrev.end = rleNext.end;
                    row.splice(rleIndex, 1);
                }
                else if ((rleNext === null || rleNext === void 0 ? void 0 : rleNext.start) === i) {
                    rleNext.start++;
                    if (rleNext.start === rleNext.end) {
                        row.splice(rleIndex, 1);
                        rleNext = row[rleIndex];
                        if ((rleNext === null || rleNext === void 0 ? void 0 : rleNext.start) === i + 1 && rleNext.value === value) {
                            rlePrev.end = rleNext.end;
                            row.splice(rleIndex, 1);
                        }
                    }
                }
                return;
            }
            if ((rleNext === null || rleNext === void 0 ? void 0 : rleNext.value) === value && rleNext.start === i + 1) {
                rleNext.start--;
                if ((rlePrev === null || rlePrev === void 0 ? void 0 : rlePrev.end) > i) {
                    rlePrev.end = i;
                    if (rlePrev.end === rlePrev.start) {
                        row.splice(rleIndex, 1);
                    }
                }
                return;
            }
            if ((rleNext === null || rleNext === void 0 ? void 0 : rleNext.start) === i && rleNext.end === i + 1) {
                rleNext.value = value;
                const nextnext = row[rleIndex + 1];
                if ((nextnext === null || nextnext === void 0 ? void 0 : nextnext.start) == i + 1 && nextnext.value === value) {
                    row.splice(rleIndex + 1, 1);
                    rleNext.end = nextnext.end;
                }
                return;
            }
            if (i === (rleNext === null || rleNext === void 0 ? void 0 : rleNext.start)) {
                rleNext.start++;
            }
            if (isAfter && end > i + 1) {
                row.splice(insertIndex, 0, rleInsert, {
                    start: i + 1,
                    end: rlePrev.end,
                    value: rlePrev.value,
                });
            }
            else {
                row.splice(insertIndex, 0, rleInsert);
            }
            if ((rlePrev === null || rlePrev === void 0 ? void 0 : rlePrev.end) > i) {
                rlePrev.end = i;
            }
        };
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.jMultiple = width;
        this.kMultiple = this.jMultiple * height;
    }
    getRLE(i, j, k = 0) {
        const row = this.rows.get(j + k * this.height);
        if (!row) {
            return;
        }
        const index = this.findIndex(row, i);
        const rle = row[index];
        return i >= (rle === null || rle === void 0 ? void 0 : rle.start) ? rle : undefined;
    }
    findIndex(row, i) {
        for (let index = 0; index < row.length; index++) {
            const { end: iEnd } = row[index];
            if (i < iEnd) {
                return index;
            }
        }
        return row.length;
    }
    clear() {
        this.rows.clear();
    }
    keys() {
        return [...this.rows.keys()];
    }
    getPixelData(k = 0, pixelData) {
        if (!pixelData) {
            pixelData = new this.pixelDataConstructor(this.width * this.height * this.numComps);
        }
        else {
            pixelData.fill(0);
        }
        const { width, height, numComps } = this;
        for (let j = 0; j < height; j++) {
            const row = this.getRun(j, k);
            if (!row) {
                continue;
            }
            if (numComps === 1) {
                for (const rle of row) {
                    const rowOffset = j * width;
                    const { start, end, value } = rle;
                    for (let i = start; i < end; i++) {
                        pixelData[rowOffset + i] = value;
                    }
                }
            }
            else {
                for (const rle of row) {
                    const rowOffset = j * width * numComps;
                    const { start, end, value } = rle;
                    for (let i = start; i < end; i += numComps) {
                        for (let comp = 0; comp < numComps; comp++) {
                            pixelData[rowOffset + i + comp] = value[comp];
                        }
                    }
                }
            }
        }
        return pixelData;
    }
}
exports.default = RLEVoxelMap;
//# sourceMappingURL=RLEVoxelMap.js.map
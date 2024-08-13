"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRandomSampleFromArray = void 0;
function getRandomSampleFromArray(array, size) {
    const clonedArray = [...array];
    if (size >= clonedArray.length) {
        shuffleArray(clonedArray);
        return clonedArray;
    }
    shuffleArray(clonedArray);
    return clonedArray.slice(0, size);
}
exports.getRandomSampleFromArray = getRandomSampleFromArray;
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
//# sourceMappingURL=getRandomSampleFromArray.js.map
import { Point2, Point4, CPUFallbackLookupTable } from '../../../../types';
declare class LookupTable implements CPUFallbackLookupTable {
    NumberOfColors: number;
    Ramp: string;
    TableRange: Point2;
    HueRange: Point2;
    SaturationRange: Point2;
    ValueRange: Point2;
    AlphaRange: Point2;
    NaNColor: Point4;
    BelowRangeColor: Point4;
    UseBelowRangeColor: boolean;
    AboveRangeColor: Point4;
    UseAboveRangeColor: boolean;
    InputRange: Point2;
    Table: Point4[];
    constructor();
    setNumberOfTableValues(number: any): void;
    setRamp(ramp: any): void;
    setTableRange(start: any, end: any): void;
    setHueRange(start: any, end: any): void;
    setSaturationRange(start: any, end: any): void;
    setValueRange(start: any, end: any): void;
    setRange(start: any, end: any): void;
    setAlphaRange(start: any, end: any): void;
    getColor(scalar: any): Point4;
    build(force: any): void;
    private buildSpecialColors;
    private mapValue;
    private getIndex;
    setTableValue(index: any, rgba: any): void;
}
export default LookupTable;
//# sourceMappingURL=lookupTable.d.ts.map
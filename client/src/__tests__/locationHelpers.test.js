import { describe, expect, test } from "vitest"
import { deg2rad, haversineFormulaKm, isValidCoords } from "../util/locationHelpers";

describe('Test suite for the deg2rad utility function', () => {
    test('should return infinity when the function input is missing', () => {
        expect(deg2rad()).toBeCloseTo(Infinity);
    });

    test('should return infinity when there is a non-number input', () => {
        expect(deg2rad('0')).toBeCloseTo(Infinity);
        expect(deg2rad([])).toBeCloseTo(Infinity);
    });

    test('should return a number converted from degrees to radians with valid input', () =>{
        expect(deg2rad(90)).toBeCloseTo(1.5708);
        expect(deg2rad(-45)).toBeCloseTo(-0.7853);
    });
});

describe('Test suite for the isValidCoords utility function', () => {
    test('should return false when there are arguments missing', () => {
        expect(isValidCoords(17)).toBe(false);
        expect(isValidCoords()).toBe(false);
    });

    test('should return false when the lat input is not a number', () => {
        expect(isValidCoords('a', 17)).toBe(false);
        expect(isValidCoords(false, 17)).toBe(false);
        expect(isValidCoords(undefined, 17)).toBe(false);
    });

    test('should return false when the lng input is not a number', () => {
        expect(isValidCoords(20, false)).toBe(false);
        expect(isValidCoords(20, 'a')).toBe(false);
        expect(isValidCoords(20, undefined)).toBe(false);
    });

    test('should return false when the lat input is not between -90 and 90 inclusive', () => {
        expect(isValidCoords(91, 17)).toBe(false);
        expect(isValidCoords(-100, 17)).toBe(false);
    });

    test('should return false when the lng input is not between -180 and 180 inclusive', () => {
        expect(isValidCoords(50, -500)).toBe(false);
        expect(isValidCoords(50, 250)).toBe(false);
    });

    test('should return true for valid inputs', () => {
        expect(isValidCoords(40, 180)).toBe(true);
        expect(isValidCoords(-90, 180)).toBe(true);
        expect(isValidCoords(0, 0)).toBe(true);
    });
});

describe('Test suite for the haversineFormulaKm utility function', () => {
    test('should return infinity for missing inputs', () => {
        expect(haversineFormulaKm()).toBeCloseTo(Infinity);
        expect(haversineFormulaKm(50)).toBeCloseTo(Infinity);
        expect(haversineFormulaKm(60, 10)).toBeCloseTo(Infinity);
        expect(haversineFormulaKm(60, 10, 100)).toBeCloseTo(Infinity);
    });

    test('should return infinity for non-number inputs', () => {
        expect(haversineFormulaKm('a', 10, 100, 50)).toBeCloseTo(Infinity);
        expect(haversineFormulaKm(0, [10], 100, 50)).toBeCloseTo(Infinity);
        expect(haversineFormulaKm(0, 10, true, 50)).toBeCloseTo(Infinity);
        expect(haversineFormulaKm('a', 10, 100, undefined)).toBeCloseTo(Infinity);
    });

    test('should return infinity for out of bound inputs', () => {
        expect(haversineFormulaKm(1000, 10, 100, 50)).toBeCloseTo(Infinity);
        expect(haversineFormulaKm(0, -8000, 100, 50)).toBeCloseTo(Infinity);
        expect(haversineFormulaKm(0, 10, 600, 50)).toBeCloseTo(Infinity);
        expect(haversineFormulaKm('a', 10, 100, -555)).toBeCloseTo(Infinity);
    });

    test('should return correct distance for random coordinates within 250km', () => {
        //Test within ~0-9km of error
        expect(haversineFormulaKm(48.2082, 16.3738, 50.0755, 14.4378)).toBeCloseTo(250, -1);
        expect(haversineFormulaKm(41.1496, -8.6109, 42.2406, -8.7207)).toBeCloseTo(120, -1);
    });
});
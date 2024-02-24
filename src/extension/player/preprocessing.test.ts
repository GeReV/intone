import { describe, expect, test } from "vitest";
import { expandUnits } from "~/player/preprocessing";

describe("expandUnits", () => {
  test.each([
    ["5 mm", "5 millimeters"],
    ["5 um", "5 micrometers"],
    ["5 \u00b5m", "5 micrometers"],
    ["5 \u03bcm", "5 micrometers"],
    ["1.5 cm", "1.5 centimeters"],
    ["10 km", "10 kilometers"], // Adding more test cases
    ["2 lbs", "2 pounds"],
    ["3 oz", "3 ounces"],
    ["8-in", "8 inches"],
    ["1 gal", "1 gallon"],
    ["1.5 kWh", "1.5 kilowatt-hours"],
  ])("expandUnits(\"%s\") -> %s", (text, expected) => {
    expect(expandUnits(text)).toBe(expected);
  });

  test.each([
    ["1 ft", "1 foot"],
    ["2 ft", "2 feet"],
    ["1 in", "1 inch"],
    ["2 in", "2 inches"],
    ["1 mph", "1 mile per hour"],
    ["2 mph", "2 miles per hour"],
    ["1 kph", "1 kilometer per hour"],
    ["2 kph", "2 kilometers per hour"],
    ["1 km/h", "1 kilometer per hour"],
    ["2 km/h", "2 kilometers per hour"],
    ["1 w", "1 watt"],
    ["2 w", "2 watts"],
  ])("expandUnits(\"%s\") -> %s", (text, expected) => {
    expect(expandUnits(text)).toBe(expected);
  });

  test.each([
    ["-5 cm", "-5 centimeters"],
    ["-2 lbs", "-2 pounds"],
  ])("expandUnits(\"%s\") -> %s", (text, expected) => {
    expect(expandUnits(text)).toBe(expected);
  });

  test.each([
    ["0.5 mm", "0.5 millimeters"],
    ["1e3 cm", "1,000 centimeters"],
    ["1.2e3 cm", "1,200 centimeters"],
    ["12e3 cm", "12,000 centimeters"],
  ])("expandUnits(\"%s\") -> %s", (text, expected) => {
    expect(expandUnits(text)).toBe(expected);
  });

  test.each([
    ["The length is 5 mm.", "The length is 5 millimeters."],
    ["The width is 1.5 cm and the height is 2 inches.", "The width is 1.5 centimeters and the height is 2 inches."],
    ["The distance is 10 km, and the time taken is 2 hours.", "The distance is 10 kilometers, and the time taken is 2 hours."],
    ["The weight is 2 lbs and the volume is 3 gal.", "The weight is 2 pounds and the volume is 3 gallons."],
    ["The weight is -3 oz.", "The weight is -3 ounces."],
    ["The temperature is 25 deg C.", "The temperature is 25 degrees Celsius."],
    ["The speed is 50 mph and the acceleration is 10 m/s^2.", "The speed is 50 miles per hour and the acceleration is 10 meters per second squared."],
    ["The data size is 1 KB.", "The data size is 1 kilobyte."],
    ["The power is 500 mW and the energy is 2 kWh.", "The power is 500 milliwatts and the energy is 2 kilowatt-hours."],
  ])("expandUnits(\"%s\") -> %s", (text, expected) => {
    expect(expandUnits(text)).toBe(expected);
  });

  test.each([
    ["5 apples", "5 apples"],
    ["2 oranges", "2 oranges"],
  ])("expandUnits(\"%s\") -> %s", (text, expected) => {
    expect(expandUnits(text)).toBe(expected);
  });
});

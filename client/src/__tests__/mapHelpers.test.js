import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createMap } from '../util/mapHelpers';
import { Loader } from '@googlemaps/js-api-loader';
import { isValidCoords } from '../util/locationHelpers';


vi.mock('@googlemaps/js-api-loader', () => ({
  Loader: vi.fn(),
}));

vi.mock('../util/locationHelpers', () => ({
  isValidCoords: vi.fn(),
}));

describe('tests the createMap utility function', () => {
  let mockMapInstance;
  let mockMarkerConstructor;
  let mockLoaderInstance;
  let mockRef;

  beforeEach(() => {
    //clear all mocks to default state
    mockMapInstance = {};
    mockMarkerConstructor = vi.fn();
    mockRef = { current: {} };

    global.google = {
      maps: {
        Map: vi.fn(() => mockMapInstance),
        Marker: mockMarkerConstructor,
      },
    };

    mockLoaderInstance = {
      load: vi.fn().mockResolvedValue(global.google),
    };

    Loader.mockImplementation(() => mockLoaderInstance);
    isValidCoords.mockImplementation(() => true);
  });

  test('should initialize map and add valid markers', async () => {
    const lat = 43.6532;
    const lng = -79.3832;
    const apiKey = 'test-key';
    const markers = [
      { lat: 38.5111, lng: -74.1814 },
      { lat: 90, lng: 180 },
    ];

    await createMap(lat, lng, apiKey, markers, mockRef);

    expect(Loader).toHaveBeenCalledWith({
      apiKey,
      version: 'weekly',
      libraries: ['places'],
    });

    expect(mockLoaderInstance.load).toHaveBeenCalled();
    expect(global.google.maps.Map).toHaveBeenCalledWith(mockRef.current, {
      center: { lat, lng },
      zoom: 11,
    });

    expect(mockMarkerConstructor).toHaveBeenCalledTimes(2);
    expect(mockMarkerConstructor).toHaveBeenCalledWith({
      position: markers[0],
      map: mockMapInstance,
    });
    expect(mockMarkerConstructor).toHaveBeenCalledWith({
      position: markers[1],
      map: mockMapInstance,
    });
  });

  test('should filter out invalid markers', async () => {
    //Assume only one provided coordinate is valid.
    isValidCoords.mockImplementation((lat, lng) => lat === 40.1 && lng === -74.1);

    const markers = [
      { lat: 40.1, lng: -74.1 }, // valid
      { lat: 'a', lng: -74.2 }, // invalid
      { lat: 80.3, lng: undefined}, // invalid
    ];

    await createMap(40, -74, 'test-key', markers, mockRef);

    expect(mockMarkerConstructor).toHaveBeenCalledTimes(1);
    expect(mockMarkerConstructor).toHaveBeenCalledWith({
      position: markers[0],
      map: mockMapInstance,
    });
  });

  test('should handle non-array markers', async () => {
    await createMap(40, -74, 'test-key', null, mockRef);

    expect(mockMarkerConstructor).not.toHaveBeenCalled();
  });
});




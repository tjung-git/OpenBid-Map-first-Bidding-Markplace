import React, { useState, useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import PlacesAutocomplete, { geocodeByAddress, getLatLng } from 'react-places-autocomplete';
import { cfg } from "../services/config";
import { TextInput } from '@carbon/react';
import { Text } from '@carbon/react/lib/components/Text';

export default function SearchAutocomplete({ onSelectPlace }){
  const [address, setAddress] = useState('');
  const [isLoaded, setIsloaded] = useState(false);
  const loaderRef = useRef(null); // Ref to store the loader instance

  useEffect(() => {
    loaderRef.current = new Loader({
      apiKey: cfg.mapsKey,
      version: 'weekly',
      libraries: ['places'],
    });

    loaderRef.current.load().then(() => {
      setIsloaded(true);
    }).catch(e => {
      console.error('Error loading Google Maps API:', e);
    });
    }, []);

    const handleChange = (newAddress) => {
      setAddress(newAddress);
    };

    const handleSelect = async (selectedAddress) => {
      setAddress(selectedAddress);
      try {
        const results = await geocodeByAddress(selectedAddress);
        const latLng = await getLatLng(results[0]);
        onSelectPlace({ address: selectedAddress, latLng });
      } catch (error) {
        console.error('Error selecting place:', error);
      }
    };

    return (
      isLoaded && !cfg.prototype? 
      <PlacesAutocomplete
        value={address}
        onChange={handleChange}
        onSelect={handleSelect}
      >
        {({ getInputProps, suggestions, getSuggestionItemProps, loading }) => (
          <div>
            <TextInput
              {...getInputProps({
                placeholder: 'Search for a location...',
                className: 'location-search-input',
              })}
                id="search-autocomplete-input"
                labelText="Location Search"
                helperText="Map will be centered on the selected location."
              />
            <Text>
              {loading ? <div>Loading...</div> : 
                suggestions.map((suggestion) => {
                return (
                  <div
                    {...getSuggestionItemProps(suggestion)}
                  >
                    <span>{suggestion.description}</span>
                  </div>
                );
              })}
            </Text>
          </div>
        )}
      </PlacesAutocomplete> : <div></div>
    );
};
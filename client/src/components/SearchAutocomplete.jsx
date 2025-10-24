import React, { useState, useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import PlacesAutocomplete, { geocodeByAddress, getLatLng } from 'react-places-autocomplete';
import { cfg } from "../services/config";
import { Column, FlexGrid, Row, Search } from '@carbon/react';
import "../styles/components/search.css";

export default function SearchAutocomplete({ onSelectPlace }){
  const [address, setAddress] = useState('');
  const [isLoaded, setIsloaded] = useState(false);

  useEffect(() => {
    const loader  = new Loader({
      apiKey: cfg.mapsKey,
      version: 'weekly',
      libraries: ['places'],
    });

    loader.load().then(() => {
      setIsloaded(true);
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

const handleError = (_, clearSuggestions) => {
  clearSuggestions();
}

  return (
    isLoaded && !cfg.prototype? 
    <PlacesAutocomplete
      value={address}
      onChange={handleChange}
      onSelect={handleSelect}
      onError={handleError}
    >
      {({ getInputProps, suggestions, getSuggestionItemProps, loading }) => (
        <div>
          <Search
            {...getInputProps({
              placeholder: 'Search for a location...'
            })}
              id="search-autocomplete-input"
              labelText="Location Search"
            />
          <div id="suggestions-grid-container">
            <FlexGrid id="suggestions-grid" >
              <Column id="suggestions-grid-column">
              {loading ? <div>Loading...</div> : 
                suggestions.map((suggestion) => {
                return (
                  <Row
                    {...getSuggestionItemProps(suggestion)}
                    className='suggestion'
                    key={suggestion.description}
                  >
                    <span>{suggestion.description}</span>
                  </Row>
                );
              })}
              </Column>
            </FlexGrid>
          </div>
        </div>
      )}
    </PlacesAutocomplete> : <div></div>
  );
};
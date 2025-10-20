//Verifies provided coordinates
export const isValidCoords = (lat, lng) =>{
    if(typeof lat !== 'number' || typeof lng !== 'number'){
      return false;  
    }

    if(lat > 90 || lat < -90 || lng > 180 || lng < -180){
      return false;
    }

    return true;
}

//Converts a number in degrees to radians.
function deg2rad(deg) {
  return deg * (Math.PI/180);
}

//The Haversine Formula
//Using the top solution from https://stackoverflow.com/questions/27928/calculate-distance-between-two-latitude-longitude-points-haversine-formula
//Calcultes the distance between 2 coordinates in km.
export const haversineFormulaKm = (lat1, lng1, lat2, lng2) => {
  //Returns a very large number if an input is not of type number.
  if(!isValidCoords(lat1, lng1) || !isValidCoords(lat2, lng2)){
    return Infinity;  
  }

  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2-lat1);  // deg2rad below
  const dLon = deg2rad(lng2-lng1); 
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return d;
}


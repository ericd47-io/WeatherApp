import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, Dimensions } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import axios from 'axios';

const CALLOUT_WIDTH = 220;
const MIN_CALLOUT_HEIGHT = 140; // Increased height to fit more data

// --- NEW HELPER FUNCTION ---
// This function converts a wind direction from degrees (e.g., 270) to a cardinal direction (e.g., "W")
const degreesToCardinal = (deg) => {
  if (deg == null) return null;
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(deg / 45) % 8];
};

export default function App() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calloutData, setCalloutData] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    const fetchStations = async () => {
      try {
        const response = await axios.get('https://api.weather.gov/stations?limit=500');
        setStations(response.data.features);
      } catch (e) {
        console.error("Failed to fetch station data:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchStations();
  }, []);

  const handleMarkerPress = async (station) => {
    const [longitude, latitude] = station.geometry.coordinates;
    const point = await mapRef.current.pointForCoordinate({ latitude, longitude });

    setCalloutData({
      stationName: station.properties.name,
      loading: true,
      position: point,
    });

    try {
      const response = await axios.get(`https://api.weather.gov/stations/${station.properties.stationIdentifier}/observations/latest`);
      
      if (response.data && response.data.properties && response.data.properties.temperature.value != null) {
          const props = response.data.properties;
          
          // --- EXTRACT AND CONVERT NEW DATA ---
          // Wind speed: Convert meters/sec to mph and round. Use optional chaining (?.) for safety.
          const windSpeedMph = props.windSpeed?.value != null ? Math.round(props.windSpeed.value * 2.237) : null;
          // Wind direction: Use our helper function
          const windDirectionCardinal = degreesToCardinal(props.windDirection?.value);
          // Humidity: Round to nearest whole number
          const humidity = props.relativeHumidity?.value != null ? Math.round(props.relativeHumidity.value) : null;

          setCalloutData({
            stationName: station.properties.name,
            weather: {
              temp: (props.temperature.value * 9/5 + 32).toFixed(1),
              conditions: props.textDescription,
              windSpeed: windSpeedMph,
              windDirection: windDirectionCardinal,
              humidity: humidity,
            },
            loading: false,
            position: point,
          });
      } else {
          setCalloutData({ loading: false, error: "No recent observation.", position: point, stationName: station.properties.name });
      }
    } catch (e) {
      console.error("Failed to fetch observation", e);
      setCalloutData({ loading: false, error: "Fetch failed.", position: point, stationName: station.properties.name });
    }
  };

  if (loading) {
    return <View style={styles.container}><ActivityIndicator size="large" /><Text>Loading stations...</Text></View>;
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: 39.8283,
          longitude: -98.5795,
          latitudeDelta: 50,
          longitudeDelta: 50,
        }}
        onPress={() => setCalloutData(null)}
      >
        {stations.map((station) => {
          const [longitude, latitude] = station.geometry.coordinates;
          return (
            <Marker
              key={station.properties.stationIdentifier}
              coordinate={{ latitude, longitude }}
              onPress={() => handleMarkerPress(station)}
            />
          );
        })}
      </MapView>
      
      {calloutData && (
        <View 
          style={[
            styles.customCallout,
            { 
              left: calloutData.position.x - (CALLOUT_WIDTH / 2), 
              top: calloutData.position.y - MIN_CALLOUT_HEIGHT - 45
            }
          ]}
        >
          <Text style={styles.calloutTitle}>{calloutData.stationName}</Text>
          {calloutData.loading && <ActivityIndicator />}
          {calloutData.error && <Text>{calloutData.error}</Text>}
          {calloutData.weather && (
            <View>
              <Text style={styles.calloutText}>Temp: {calloutData.weather.temp} °F</Text>
              {calloutData.weather.conditions ? (
                <Text style={styles.calloutText}>Conditions: {calloutData.weather.conditions}</Text>
              ) : (
                <Text style={styles.calloutText}>Conditions: Not available</Text>
              )}
              {/* --- DISPLAY NEW DATA --- */}
              {calloutData.weather.windSpeed != null && (
                <Text style={styles.calloutText}>
                  Wind: {calloutData.weather.windSpeed} mph from the {calloutData.weather.windDirection}
                </Text>
              )}
              {calloutData.weather.humidity != null && (
                <Text style={styles.calloutText}>Humidity: {calloutData.weather.humidity}%</Text>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  customCallout: {
    position: 'absolute',
    width: CALLOUT_WIDTH,
    minHeight: MIN_CALLOUT_HEIGHT,
    padding: 10,
    backgroundColor: 'white',
    borderRadius: 10,
    borderColor: '#ccc',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
  },
  calloutTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 5,
  },
  calloutText: {
    fontSize: 14,
    marginBottom: 2, // Add a little space between lines
  }
});
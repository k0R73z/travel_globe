// Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1IjoiaWZyb3p5IiwiYSI6ImNtMXFobXNjdzAwNzgyanNlejVjdjhueG4ifQ.qEX5cljGQH0AcqeBsq39DQ';

// Check if we're in shared mode (URL has flights parameter)
const urlParams = new URLSearchParams(window.location.search);
const sharedFlightsParam = urlParams.get('flights');
const isSharedMode = !!sharedFlightsParam;

// Encode flights to URL-safe string with gzip compression
function encodeFlights(flights) {
    // Convert flights to compact format: airline|flightNum|from|to|date|year
    const compact = flights.map(f =>
        `${f.a}|${f.f}|${f.from}|${f.to}|${f.date}|${f.y}`
    ).join(';');
    
    // Compress with gzip
    const compressed = pako.deflate(compact);
    
    // Convert to base64 and make URL-safe
    const base64 = btoa(String.fromCharCode.apply(null, compressed));
    return base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

// Decode flights from URL-safe string with gzip decompression
function decodeFlights(encoded) {
    try {
        // Restore base64 padding
        let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) {
            base64 += '=';
        }
        
        // Decode base64 to binary
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Decompress with gzip
        const decompressed = pako.inflate(bytes, { to: 'string' });
        
        // Parse flights
        return decompressed.split(';').map(flightStr => {
            const [a, f, from, to, date, y] = flightStr.split('|');
            return { a, f, from, to, date, y };
        });
    } catch (e) {
        console.error('Failed to decode flights:', e);
        return [];
    }
}

// Share map function
function shareMap() {
    const allFlights = getAllFlights();
    const encoded = encodeFlights(allFlights);
    const url = `${window.location.origin}${window.location.pathname}?flights=${encoded}`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(url).then(() => {
        alert('Ссылка скопирована в буфер обмена!');
    }).catch(err => {
        console.error('Failed to copy:', err);
        // Fallback: show the URL in a prompt
        prompt('Скопируйте эту ссылку:', url);
    });
}

// LocalStorage functions for user flights
function getUserFlights() {
    const stored = localStorage.getItem('userFlights');
    return stored ? JSON.parse(stored) : [];
}

function saveUserFlights(flights) {
    localStorage.setItem('userFlights', JSON.stringify(flights));
}

function addUserFlight(flight) {
    const userFlights = getUserFlights();
    userFlights.push(flight);
    saveUserFlights(userFlights);
}

function deleteUserFlight(flightIndex) {
    const userFlights = getUserFlights();
    userFlights.splice(flightIndex, 1);
    saveUserFlights(userFlights);
    location.reload();
}

// Merge hardcoded flights with user flights
function getAllFlights() {
    // If in shared mode, return only shared flights
    if (isSharedMode && sharedFlightsParam) {
        return decodeFlights(sharedFlightsParam);
    }
    
    const userFlights = getUserFlights();
    return [...flights, ...userFlights];
}

// Toggle add flight form
function toggleAddFlightForm() {
    const form = document.getElementById('add-flight-form');
    const importForm = document.getElementById('import-form');
    const toggleBtn = document.getElementById('toggle-form-btn');
    const importBtn = document.getElementById('toggle-import-btn');
    
    if (form.style.display === 'none') {
        form.style.display = 'block';
        toggleBtn.textContent = '❌ Закрыть';
        // Close import form if open
        importForm.style.display = 'none';
        importBtn.textContent = '📤';
    } else {
        form.style.display = 'none';
        toggleBtn.textContent = '➕ Добавить';
    }
}

// Toggle import form
function toggleImportForm() {
    const form = document.getElementById('add-flight-form');
    const importForm = document.getElementById('import-form');
    const toggleBtn = document.getElementById('toggle-form-btn');
    const importBtn = document.getElementById('toggle-import-btn');
    
    if (importForm.style.display === 'none') {
        importForm.style.display = 'block';
        importBtn.textContent = '❌';
        // Close add flight form if open
        form.style.display = 'none';
        toggleBtn.textContent = '➕ Добавить';
    } else {
        importForm.style.display = 'none';
        importBtn.textContent = '📤';
    }
}

// Import CSV data
function importCSV() {
    const csvInput = document.getElementById('csv-input').value.trim();
    
    if (!csvInput) {
        alert('Пожалуйста, введите данные CSV');
        return;
    }
    
    const lines = csvInput.split('\n').filter(line => line.trim());
    const importedFlights = [];
    const errors = [];
    
    lines.forEach((line, index) => {
        const lineNum = index + 1;
        const parts = line.split(',').map(p => p.trim());
        
        if (parts.length < 5) {
            errors.push(`Строка ${lineNum}: недостаточно данных (нужно 5 полей)`);
            return;
        }
        
        const [airline, flightNumber, fromAirport, toAirport, dateTime] = parts;
        
        // Validate airports
        const fromCode = fromAirport.toUpperCase();
        const toCode = toAirport.toUpperCase();
        
        if (!airportCoordinates[fromCode]) {
            errors.push(`Строка ${lineNum}: аэропорт ${fromCode} не найден`);
            return;
        }
        if (!airportCoordinates[toCode]) {
            errors.push(`Строка ${lineNum}: аэропорт ${toCode} не найден`);
            return;
        }
        
        // Parse date and time
        // Expected format: DD.MM.YYYY HH:MM or DD.MM.YYYY
        let datePart, year;
        
        if (dateTime.includes(' ')) {
            datePart = dateTime.split(' ')[0];
        } else {
            datePart = dateTime;
        }
        
        const dateMatch = datePart.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        if (!dateMatch) {
            errors.push(`Строка ${lineNum}: неверный формат даты (ожидается ДД.ММ.ГГГГ)`);
            return;
        }
        
        year = dateMatch[3];
        
        // Create flight object
        const newFlight = {
            a: airline || 'Unknown',
            f: flightNumber || '',
            from: fromCode,
            to: toCode,
            date: datePart,
            y: year
        };
        
        importedFlights.push(newFlight);
    });
    
    // Show errors if any
    if (errors.length > 0) {
        alert('Ошибки при импорте:\n\n' + errors.join('\n') + '\n\nИмпортировано успешно: ' + importedFlights.length + ' из ' + lines.length);
    }
    
    // Import successful flights
    if (importedFlights.length > 0) {
        const userFlights = getUserFlights();
        userFlights.push(...importedFlights);
        saveUserFlights(userFlights);
        
        // Clear input
        document.getElementById('csv-input').value = '';
        
        // Close form
        toggleImportForm();
        
        // Show success message
        if (errors.length === 0) {
            alert(`Успешно импортировано ${importedFlights.length} маршрутов!`);
        }
        
        // Reload page to update map
        location.reload();
    } else if (errors.length === 0) {
        alert('Нет данных для импорта');
    }
}

// Download all routes as CSV
function downloadCSV() {
    const allFlights = getAllFlights();
    
    if (allFlights.length === 0) {
        alert('Нет маршрутов для скачивания');
        return;
    }
    
    // Convert flights to CSV format: авиалиния,рейс,откуда,куда,датавремя
    const csvLines = allFlights.map(flight => {
        const airline = flight.a || 'Unknown';
        const flightNumber = flight.f || '';
        const from = flight.from;
        const to = flight.to;
        const date = flight.date; // Already in DD.MM.YYYY format
        
        return `${airline},${flightNumber},${from},${to},${date}`;
    });
    
    const csvContent = csvLines.join('\n');
    
    // Create a blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    // Create download URL
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    // Generate filename with current date
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    link.setAttribute('download', `flight_routes_${dateStr}.csv`);
    
    // Trigger download
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL
    URL.revokeObjectURL(url);
}

// Add flight from form
function addFlight(event) {
    event.preventDefault();
    
    const flightNumber = document.getElementById('flight-number').value.trim();
    const airline = document.getElementById('airline').value.trim();
    const fromAirport = document.getElementById('from-airport').value.trim().toUpperCase();
    const toAirport = document.getElementById('to-airport').value.trim().toUpperCase();
    const flightDate = document.getElementById('flight-date').value;
    
    // Validate airports exist
    if (!airportCoordinates[fromAirport]) {
        alert(`Аэропорт ${fromAirport} не найден в базе данных`);
        return;
    }
    if (!airportCoordinates[toAirport]) {
        alert(`Аэропорт ${toAirport} не найден в базе данных`);
        return;
    }
    
    // Convert date from YYYY-MM-DD to DD.MM.YYYY
    const [year, month, day] = flightDate.split('-');
    const formattedDate = `${day}.${month}.${year}`;
    
    // Create flight object in the same format as hardcoded flights
    const newFlight = {
        a: airline || 'Unknown',
        f: flightNumber || '',
        from: fromAirport,
        to: toAirport,
        date: formattedDate,
        y: year
    };
    
    // Add to localStorage
    addUserFlight(newFlight);
    
    // Reset form
    document.getElementById('flight-form').reset();
    
    // Hide form
    toggleAddFlightForm();
    
    // Reload the page to update map and statistics
    location.reload();
}

// Build airport data structures from airports_small.js
const airportToCountry = {};
const airportCoordinates = {};
const countryFlags = {};
const airportNames = {};

// Process airports from airports_small.js
airports.forEach(airport => {
    if (airport.iata_code && airport.iso_country) {
        airportToCountry[airport.iata_code] = airport.iso_country;
        airportCoordinates[airport.iata_code] = [
            airport.longitude_deg,
            airport.latitude_deg
        ];
        airportNames[airport.iata_code] = airport.name;
        // Store country flag if we have it
        if (airport.icon) {
            countryFlags[airport.iso_country] = airport.icon;
        }
    }
});

console.log(`Loaded ${Object.keys(airportToCountry).length} airports from ${Object.keys(countryFlags).length} countries`);

// Initialize map
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',
    projection: 'globe',
    center: [37.6, 50.0],
    zoom: 1.5,
    pitch: 0,
    minZoom: 2,
    maxZoom: 18
});

// Add navigation controls (zoom buttons)
map.addControl(new mapboxgl.NavigationControl({
    showCompass: true,
    showZoom: true,
    visualizePitch: true
}), 'top-right');

// Add fullscreen control
map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

// Enable scroll zoom
map.scrollZoom.enable();

// Enable fog for better globe appearance
map.on('style.load', () => {
    map.setFog({
        'range': [0.8, 8],
        'color': '#000000',
        'horizon-blend': 0.1,
        'high-color': '#245bde',
        'space-color': '#000000',
        'star-intensity': 0.15
    });
});

// Generate color for years not in the predefined list
function getYearColor(year) {
    if (yearColors[year]) {
        return yearColors[year];
    }
    // Generate a color for new years
    const colors = ['#9b59b6', '#34495e', '#16a085', '#27ae60', '#d35400', '#c0392b', '#8e44ad'];
    const yearNum = parseInt(year);
    return colors[yearNum % colors.length];
}

let hoveredRouteId = null;

// Initialize visible years with all years from all flights
const allFlights = getAllFlights();
let visibleYears = new Set(allFlights.map(f => f.y));

// Ensure all years have colors assigned
allFlights.forEach(flight => {
    if (flight.y && !yearColors[flight.y]) {
        yearColors[flight.y] = getYearColor(flight.y);
    }
});

// Function to extract visited countries from flight data
function getVisitedCountries() {
    const visited = new Set();
    const countryStats = {};
    const countryFirstYear = {};
    
    const allFlights = getAllFlights();
    allFlights.forEach(flight => {
        const fromCountry = airportToCountry[flight.from];
        const toCountry = airportToCountry[flight.to];
        
        if (fromCountry) {
            visited.add(fromCountry);
            countryStats[fromCountry] = (countryStats[fromCountry] || 0) + 1;
            if (!countryFirstYear[fromCountry]) {
                countryFirstYear[fromCountry] = flight.y;
            }
        }
        if (toCountry) {
            visited.add(toCountry);
            countryStats[toCountry] = (countryStats[toCountry] || 0) + 1;
            if (!countryFirstYear[toCountry]) {
                countryFirstYear[toCountry] = flight.y;
            }
        }
    });
    
    return {
        countries: Array.from(visited),
        stats: countryStats,
        firstYear: countryFirstYear
    };
}

// Calculate statistics
function calculateStats() {
    const visitedCountries = getVisitedCountries();
    const allFlights = getAllFlights();
    
    const stats = {
        overall: {
            flights: allFlights.length,
            countries: visitedCountries.countries.length,
            countriesList: visitedCountries.countries.sort(),
            airlines: new Set(allFlights.map(f => f.a)).size,
            airlinesList: [...new Set(allFlights.map(f => f.a))].sort()
        },
        byYear: {}
    };
    
    // Track countries visited up to each year
    const countriesSeenBefore = new Set();
    
    // Get unique years from flights and sort them
    const years = [...new Set(allFlights.map(f => f.y))].sort();
    
    years.forEach(year => {
        const yearFlights = allFlights.filter(f => f.y === year);
        
        // Calculate countries visited in this year
        const yearCountries = new Set();
        yearFlights.forEach(flight => {
            const fromCountry = airportToCountry[flight.from];
            const toCountry = airportToCountry[flight.to];
            if (fromCountry) yearCountries.add(fromCountry);
            if (toCountry) yearCountries.add(toCountry);
        });
        
        // Find new countries (not seen before this year)
        const newCountries = [];
        yearCountries.forEach(country => {
            if (!countriesSeenBefore.has(country)) {
                newCountries.push(country);
                countriesSeenBefore.add(country);
            }
        });
        
        stats.byYear[year] = {
            flights: yearFlights.length,
            countries: yearCountries.size,
            newCountries: newCountries.length,
            newCountriesList: newCountries.sort(),
            airlines: new Set(yearFlights.map(f => f.a)).size,
            airlinesList: [...new Set(yearFlights.map(f => f.a))].sort()
        };
    });
    
    return stats;
}

// Render statistics panel
function renderStatsPanel() {
    const stats = calculateStats();
    
    // Get all years from stats (includes both hardcoded and user flights)
    const allYears = Object.keys(stats.byYear).sort().reverse();
    
    // Render year filters
    const yearFiltersDiv = document.getElementById('year-filters');
    yearFiltersDiv.innerHTML = allYears.map(year => `
        <div class="year-filter active" id="filter-${year}" onclick="toggleYear('${year}')">
            <div class="year-label">
                <div class="year-color" style="background-color: ${getYearColor(year)}"></div>
                <span class="year-name">${year}</span>
                <span class="year-count">(${stats.byYear[year].flights} рейсов)</span>
            </div>
        </div>
    `).join('');
    
    // Render overall statistics
    const overallStatsDiv = document.getElementById('overall-stats');
    overallStatsDiv.innerHTML = `
        <div class="stat-row">
            <span class="stat-label">Всего перелетов:</span>
            <span class="stat-value">${stats.overall.flights}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Посещено стран:</span>
            <span class="stat-value">${stats.overall.countries}</span>
        </div>
        <div class="airline-list">
            ${stats.overall.countriesList.map(code => countryFlags[code] || code).join(' ')}
        </div>
        <div class="stat-row">
            <span class="stat-label">Авиакомпаний:</span>
            <span class="stat-value">${stats.overall.airlines}</span>
        </div>
        <div class="airline-list">
            ${stats.overall.airlinesList.join(', ')}
        </div>
    `;
    
    // Render per-year statistics
    const yearStatsDiv = document.getElementById('year-stats');
    yearStatsDiv.innerHTML = allYears.map(year => `
        <div class="stats-section">
            <h3 style="color: ${getYearColor(year)}">${year}</h3>
            <div class="stat-row">
                <span class="stat-label">Перелетов:</span>
                <span class="stat-value">${stats.byYear[year].flights}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Новых стран:</span>
                <span class="stat-value">${stats.byYear[year].newCountries}</span>
            </div>
            ${stats.byYear[year].newCountries > 0 ? `
            <div class="airline-list">
                ${stats.byYear[year].newCountriesList.map(code => countryFlags[code] || code).join(' ')}
            </div>
            ` : ''}
            <div class="stat-row">
                <span class="stat-label">Авиакомпаний:</span>
                <span class="stat-value">${stats.byYear[year].airlines}</span>
            </div>
            <div class="airline-list">
                ${stats.byYear[year].airlinesList.join(', ')}
            </div>
        </div>
    `).join('');
}

// Toggle year visibility
function toggleYear(year) {
    const filterElement = document.getElementById(`filter-${year}`);
    if (visibleYears.has(year)) {
        visibleYears.delete(year);
        filterElement.classList.remove('active');
        filterElement.classList.add('inactive');
    } else {
        visibleYears.add(year);
        filterElement.classList.remove('inactive');
        filterElement.classList.add('active');
    }
    updateRouteVisibility();
}

// Toggle all years
function toggleAllYears() {
    const allFlights = getAllFlights();
    const allYears = [...new Set(allFlights.map(f => f.y))];
    
    if (visibleYears.size === allYears.length) {
        // Hide all
        visibleYears.clear();
        allYears.forEach(year => {
            const filterElement = document.getElementById(`filter-${year}`);
            if (filterElement) {
                filterElement.classList.remove('active');
                filterElement.classList.add('inactive');
            }
        });
    } else {
        // Show all
        visibleYears = new Set(allYears);
        allYears.forEach(year => {
            const filterElement = document.getElementById(`filter-${year}`);
            if (filterElement) {
                filterElement.classList.remove('inactive');
                filterElement.classList.add('active');
            }
        });
    }
    updateRouteVisibility();
}

// Update route visibility based on selected years
function updateRouteVisibility() {
    if (!map.getLayer('route-lines')) return;
    
    const filter = visibleYears.size > 0
        ? ['in', ['get', 'year'], ['literal', Array.from(visibleYears)]]
        : ['==', ['get', 'year'], ''];
    
    map.setFilter('route-lines', filter);
}

// Initialize stats panel
renderStatsPanel();

// Hide entire add-flight section in shared mode (read-only mode)
// Show "My Session" button instead
if (isSharedMode) {
    const addFlightSection = document.querySelector('.add-flight-section');
    if (addFlightSection) {
        addFlightSection.style.display = 'none';
    }
    
    const mySessionSection = document.getElementById('my-session-section');
    if (mySessionSection) {
        mySessionSection.style.display = 'block';
    }
}

// Function to open user's own session (without ?flights parameter)
function openMySession() {
    const url = `${window.location.origin}${window.location.pathname}`;
    window.location.href = url;
}

// Function to create a great circle arc between two points
function createArc(start, end, numPoints = 100) {
    const [lon1, lat1] = start;
    const [lon2, lat2] = end;
    
    const coordinates = [];
    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        
        // Great circle interpolation
        const lat1Rad = lat1 * Math.PI / 180;
        const lat2Rad = lat2 * Math.PI / 180;
        const lon1Rad = lon1 * Math.PI / 180;
        const lon2Rad = lon2 * Math.PI / 180;
        
        const d = 2 * Math.asin(Math.sqrt(
            Math.pow(Math.sin((lat1Rad - lat2Rad) / 2), 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.pow(Math.sin((lon1Rad - lon2Rad) / 2), 2)
        ));
        
        const a = Math.sin((1 - t) * d) / Math.sin(d);
        const b = Math.sin(t * d) / Math.sin(d);
        
        const x = a * Math.cos(lat1Rad) * Math.cos(lon1Rad) +
                 b * Math.cos(lat2Rad) * Math.cos(lon2Rad);
        const y = a * Math.cos(lat1Rad) * Math.sin(lon1Rad) +
                 b * Math.cos(lat2Rad) * Math.sin(lon2Rad);
        const z = a * Math.sin(lat1Rad) + b * Math.sin(lat2Rad);
        
        const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI;
        const lon = Math.atan2(y, x) * 180 / Math.PI;
        
        coordinates.push([lon, lat]);
    }
    
    return coordinates;
}

// Wait for map to load
map.on('load', () => {
    // Get visited countries data
    const visitedData = getVisitedCountries();
    
    // Add visited countries fill layer (scratch map effect)
    map.addLayer({
        id: 'visited-countries-fill',
        type: 'fill',
        source: {
            type: 'vector',
            url: 'mapbox://mapbox.country-boundaries-v1'
        },
        'source-layer': 'country_boundaries',
        paint: {
            'fill-color': [
                'match',
                ['get', 'iso_3166_1'],
                visitedData.countries,
                '#FFD700', // Gold color for visited countries
                'rgba(0,0,0,0)' // Transparent for unvisited
            ],
            'fill-opacity': 0.35
        }
    });

    // Add country boundaries layer (enhanced visibility)
    map.addLayer({
        id: 'country-boundaries',
        type: 'line',
        source: {
            type: 'vector',
            url: 'mapbox://mapbox.country-boundaries-v1'
        },
        'source-layer': 'country_boundaries',
        paint: {
            'line-color': '#627BC1',
            'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                0, 1,
                4, 2,
                8, 3
            ],
            'line-opacity': 0.8
        }
    }, 'waterway-label');

    // Add major cities layer
    map.addSource('major-cities', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: majorCities.map(city => ({
                type: 'Feature',
                properties: { name: city.name },
                geometry: {
                    type: 'Point',
                    coordinates: city.coords
                }
            }))
        }
    });

    // Add city points
    map.addLayer({
        id: 'city-points',
        type: 'circle',
        source: 'major-cities',
        paint: {
            'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                1, 2,
                4, 4,
                8, 6
            ],
            'circle-color': '#ffd700',
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.8
        }
    });

    // Add city labels
    map.addLayer({
        id: 'city-labels',
        type: 'symbol',
        source: 'major-cities',
        layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
            'text-size': [
                'interpolate',
                ['linear'],
                ['zoom'],
                1, 8,
                4, 11,
                8, 14
            ],
            'text-offset': [0, 1.2],
            'text-anchor': 'top'
        },
        paint: {
            'text-color': '#ffd700',
            'text-halo-color': '#000000',
            'text-halo-width': 1.5,
            'text-opacity': [
                'interpolate',
                ['linear'],
                ['zoom'],
                1, 0.5,
                3, 0.8,
                5, 1
            ]
        }
    });

    // Create GeoJSON for flight routes
    const allFlights = getAllFlights();
    const hardcodedFlightsCount = flights.length;
    const routeFeatures = allFlights.map((flight, index) => {
        const start = airportCoordinates[flight.from];
        const end = airportCoordinates[flight.to];
        
        if (!start || !end) return null;
        
        // Check if this flight is from localStorage (index >= hardcoded flights count)
        const isUserFlight = index >= hardcodedFlightsCount;
        const userFlightIndex = isUserFlight ? index - hardcodedFlightsCount : -1;
        
        return {
            type: 'Feature',
            properties: {
                id: index,
                airline: flight.a,
                flightNumber: flight.f,
                from: flight.from,
                to: flight.to,
                date: flight.date,
                year: flight.y,
                color: getYearColor(flight.y),
                isUserFlight: isUserFlight,
                userFlightIndex: userFlightIndex
            },
            geometry: {
                type: 'LineString',
                coordinates: createArc(start, end)
            }
        };
    }).filter(f => f !== null);

    // Extract airports that appear in flights
    const flightAirports = new Set();
    allFlights.forEach(flight => {
        flightAirports.add(flight.from);
        flightAirports.add(flight.to);
    });

    // Create GeoJSON only for airports that appear in flights
    const airportFeatures = Object.entries(airportCoordinates)
        .filter(([code]) => flightAirports.has(code))
        .map(([code, coords]) => ({
            type: 'Feature',
            properties: {
                code: code
            },
            geometry: {
                type: 'Point',
                coordinates: coords
            }
        }));

    // Add route source
    map.addSource('routes', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: routeFeatures
        }
    });

    // Add airport source
    map.addSource('airports', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: airportFeatures
        }
    });

    // Add route lines layer
    map.addLayer({
        id: 'route-lines',
        type: 'line',
        source: 'routes',
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        },
        paint: {
            'line-color': ['get', 'color'],
            'line-width': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                5,
                2.5
            ],
            'line-opacity': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                1,
                0.7
            ]
        }
    });

    // Add airport points layer
    map.addLayer({
        id: 'airport-points',
        type: 'circle',
        source: 'airports',
        paint: {
            'circle-radius': 4,
            'circle-color': '#ffffff',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#000000',
            'circle-opacity': 0.9
        }
    });

    // Add airport labels layer
    map.addLayer({
        id: 'airport-labels',
        type: 'symbol',
        source: 'airports',
        layout: {
            'text-field': ['get', 'code'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 10,
            'text-offset': [0, -1.2],
            'text-anchor': 'bottom'
        },
        paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 2
        }
    });

    // Interactivity for visited countries
    map.on('mouseenter', 'visited-countries-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'visited-countries-fill', () => {
        map.getCanvas().style.cursor = '';
    });

    // Show country statistics on click
    map.on('click', 'visited-countries-fill', (e) => {
        if (e.features.length > 0) {
            const country = e.features[0].properties.iso_3166_1;
            const countryName = e.features[0].properties.name_en;
            const visits = visitedData.stats[country] || 0;
            const firstYear = visitedData.firstYear[country];
            
            if (visits > 0) {
                const infoPanel = document.getElementById('info-panel');
                const flightDetail = document.getElementById('flight-detail');
                
                flightDetail.innerHTML = `
                    <div class="route-title">🌍 ${countryName}</div>
                    <div class="route-info">
                        <strong>Перелетов через эту страну:</strong> ${visits}<br>
                        <strong>Первое посещение:</strong> ${firstYear}
                    </div>
                `;
                
                infoPanel.classList.add('visible');
            }
        }
    });

    // Change cursor on hover
    map.on('mouseenter', 'route-lines', () => {
        map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'route-lines', () => {
        map.getCanvas().style.cursor = '';
    });

    // Hover effect
    map.on('mousemove', 'route-lines', (e) => {
        if (e.features.length > 0) {
            if (hoveredRouteId !== null) {
                map.setFeatureState(
                    { source: 'routes', id: hoveredRouteId },
                    { hover: false }
                );
            }
            hoveredRouteId = e.features[0].properties.id;
            map.setFeatureState(
                { source: 'routes', id: hoveredRouteId },
                { hover: true }
            );
        }
    });

    map.on('mouseleave', 'route-lines', () => {
        if (hoveredRouteId !== null) {
            map.setFeatureState(
                { source: 'routes', id: hoveredRouteId },
                { hover: false }
            );
        }
        hoveredRouteId = null;
    });

    // Click on route to show details
    map.on('click', 'route-lines', (e) => {
        if (e.features.length > 0) {
            const props = e.features[0].properties;
            const infoPanel = document.getElementById('info-panel');
            const flightDetail = document.getElementById('flight-detail');
            
            // Don't show delete button in shared mode
            const deleteButton = (props.isUserFlight && !isSharedMode)
                ? `<button class="delete-flight-btn" onclick="deleteUserFlight(${props.userFlightIndex})">🗑️ Удалить перелет</button>`
                : '';
            
            const fromName = airportNames[props.from] || props.from;
            const toName = airportNames[props.to] || props.to;
            
            flightDetail.innerHTML = `
                <div class="route-title">${props.airline} | ${props.flightNumber}</div>
                <div class="route-info">
                    <strong>Откуда:</strong> ${fromName} (${props.from})<br>
                    <strong>Куда:</strong> ${toName} (${props.to})<br>
                    <strong>Дата:</strong> ${props.date}
                </div>
                ${deleteButton}
            `;
            
            infoPanel.classList.add('visible');
        }
    });

    // Click outside routes to hide details
    map.on('click', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['route-lines'] });
        if (features.length === 0) {
            const infoPanel = document.getElementById('info-panel');
            infoPanel.classList.remove('visible');
        }
    });

    // Rotate globe slowly
    let userInteracting = false;
    let spinEnabled = true;

    map.on('mousedown', () => { userInteracting = true; });
    map.on('mouseup', () => { userInteracting = false; });
    map.on('dragend', () => { userInteracting = false; });
    map.on('pitchend', () => { userInteracting = false; });
    map.on('rotateend', () => { userInteracting = false; });
    map.on('zoomstart', () => { userInteracting = true; });
    map.on('zoomend', () => { userInteracting = false; });
    map.on('wheel', () => { userInteracting = true; });
    
    // Touch events for mobile
    map.on('touchstart', () => { userInteracting = true; });
    map.on('touchend', () => {
        setTimeout(() => { userInteracting = false; }, 300);
    });
    map.on('touchmove', () => { userInteracting = true; });

    function spinGlobe() {
        if (spinEnabled && !userInteracting) {
            const center = map.getCenter();
            center.lng -= 0.1;
            map.easeTo({ center, duration: 100, easing: (n) => n });
        }
        requestAnimationFrame(spinGlobe);
    }

    spinGlobe();
    
    // Reset interaction flag after wheel event
    let wheelTimeout;
    map.on('wheel', () => {
        clearTimeout(wheelTimeout);
        wheelTimeout = setTimeout(() => {
            userInteracting = false;
        }, 150);
    });
});

// Mobile: Collapsible stats panel
function initMobilePanel() {
    if (window.innerWidth <= 768) {
        const statsPanel = document.getElementById('stats-panel');
        let startY = 0;
        let currentY = 0;
        let isDragging = false;
        
        // Toggle panel on tap of the handle area
        statsPanel.addEventListener('touchstart', (e) => {
            const rect = statsPanel.getBoundingClientRect();
            const touchY = e.touches[0].clientY;
            
            // Check if touch is in the handle area (top 30px)
            if (touchY - rect.top < 30) {
                startY = touchY;
                isDragging = true;
                e.preventDefault();
            }
        }, { passive: false });
        
        statsPanel.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            
            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;
            
            // Only allow downward dragging when expanded, upward when collapsed
            if (deltaY > 50 && !statsPanel.classList.contains('collapsed')) {
                statsPanel.classList.add('collapsed');
                isDragging = false;
            } else if (deltaY < -50 && statsPanel.classList.contains('collapsed')) {
                statsPanel.classList.remove('collapsed');
                isDragging = false;
            }
        }, { passive: true });
        
        statsPanel.addEventListener('touchend', () => {
            isDragging = false;
        }, { passive: true });
        
        // Start collapsed on mobile
        statsPanel.classList.add('collapsed');
    }
}

// Initialize mobile panel on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobilePanel);
} else {
    initMobilePanel();
}

// Re-initialize on window resize
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const statsPanel = document.getElementById('stats-panel');
        if (window.innerWidth > 768) {
            statsPanel.classList.remove('collapsed');
        } else {
            statsPanel.classList.add('collapsed');
        }
    }, 250);
});

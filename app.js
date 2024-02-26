var redirect_uri = "http://127.0.0.1:5500/index.html";
var client_id = '3a0286a765f04d20b83a8c4089d74e35';
var client_secret = 'b433b06c56b24da5b27fcee34f269d5a';
var access_token = null;
var refresh_token = null;
var currentPlaylist = "";
var radioButtons = [];
var topTracksIds = [];
var selectedArtists = []; // Array to store selected artist names

const AUTHORIZE = "https://accounts.spotify.com/authorize";
const TOKEN = "https://accounts.spotify.com/api/token";
const loadingIcon = document.getElementById("loading");
const overlay = document.getElementById("overlay");

async function fetchWebApi(endpoint, method, body) {
    const res = await fetch(`https://api.spotify.com/${endpoint}`, {
        headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        method,
        body: JSON.stringify(body)
    });
    return await res.json();
}

async function getTopTracks() {
    const tracks = (await fetchWebApi(
        'v1/me/top/tracks?time_range=long_term&limit=5', 'GET'
    )).items;
    topTracksIds = tracks.map(track => track.id);
    return tracks;
}

async function getTopArtists() {
    const artists = (await fetchWebApi(
        'v1/me/top/artists?time_range=long_term&limit=20', 'GET'
    )).items;
    return artists;
}

async function getRecommendations() {
    return (await fetchWebApi(
        `v1/recommendations?limit=5&seed_tracks=${topTracksIds.join(',')}`, 'GET'
    )).tracks;
}

async function createPlaylist(tracksUri) {
    try {
        const { id: user_id } = await fetchWebApi('v1/me', 'GET');

        const playlist = await fetchWebApi(
            `v1/users/${user_id}/playlists`, 'POST', {
            "name": "My recommendation playlist",
            "description": "Playlist created by the tutorial on developer.spotify.com",
            "public": false
        });

        if (!playlist || !playlist.id) {
            throw new Error("Playlist ID not found");
        }

        await fetchWebApi(
            `v1/playlists/${playlist.id}/tracks?uris=${tracksUri.join(',')}`,
            'POST'
        );

        return playlist;
    } catch (error) {
        console.error("Error creating playlist:", error);
        throw error;
    }
}

async function init() {
    // Get the loading icon element
    const loadingIcon = document.getElementById("loading");

    // Show loading icon and overlay
    loadingIcon.style.display = "block";
    overlay.style.display = "block";

    try {

        // Fetch user's top tracks
        console.log("Fetching top artists...");
        const topTracks = await getTopTracks();
        const topArtists = await getTopArtists();
        console.log("Top artists:", topArtists);

        // Fetch recommended tracks
        const recommendedTracks = await getRecommendations();
        console.log("Recommended tracks:", recommendedTracks);

        // Combine top tracks and recommended tracks alternately
        const combinedTracks = [];
        for (let i = 0; i < topTracks.length || i < recommendedTracks.length; i++) {
            if (i < topTracks.length) {
                combinedTracks.push(topTracks[i]);
            }
            if (i < recommendedTracks.length) {
                combinedTracks.push(recommendedTracks[i]);
            }
        }

        // Shuffle the combined tracks array
        shuffleArray(combinedTracks);

        // Creating playlist with combined tracks
        const tracksUri = combinedTracks.map(track => `spotify:track:${track.id}`);

        const createdPlaylist = await createPlaylist(tracksUri);

        // Update the src attribute of the iframe with the new playlist ID
        const spotifyPlaylist = document.getElementById("spotifyPlaylist");
        spotifyPlaylist.src = `https://open.spotify.com/embed/playlist/${createdPlaylist.id}?utm_source=generator&theme=0`;

        // Hide loading icon at the end
        if (loadingIcon) {
            loadingIcon.style.display = "none";
        }

        // Display top artists
        displayTopArtists();

    } catch (error) {
        console.error("Error initializing:", error);
        throw error;
    } finally {
        // Remove loading icon and overlay
        loadingIcon.style.display = "none";
        overlay.style.display = "none";
    }
}

// Function to shuffle array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function handleRedirect() {
    let code = getCode();
    fetchAccessToken(code);
    window.history.pushState("", "", redirect_uri); // remove param from url

    // Call init to create playlist
    init();
}

function getCode() {
    let code = null;
    const queryString = window.location.search;
    if (queryString.length > 0) {
        const urlParams = new URLSearchParams(queryString);
        code = urlParams.get('code')
    }
    return code;
}

function requestAuthorization() {
    localStorage.setItem("client_id", client_id);
    localStorage.setItem("client_secret", client_secret); // In a real app you should not expose your client_secret to the user

    let url = AUTHORIZE;
    url += "?client_id=" + client_id;
    url += "&response_type=code";
    url += "&redirect_uri=" + encodeURI(redirect_uri);
    url += "&show_dialog=true";
    url += "&scope=playlist-modify-public playlist-modify-private user-read-private user-read-email user-library-read user-top-read";
    window.location.href = url; // Show Spotify's authorization screen
}

function fetchAccessToken(code) {
    let body = "grant_type=authorization_code";
    body += "&code=" + code;
    body += "&redirect_uri=" + encodeURI(redirect_uri);
    body += "&client_id=" + client_id;
    body += "&client_secret=" + client_secret;
    callAuthorizationApi(body);
}

function refreshAccessToken() {
    refresh_token = localStorage.getItem("refresh_token");
    let body = "grant_type=refresh_token";
    body += "&refresh_token=" + refresh_token;
    body += "&client_id=" + client_id;
    callAuthorizationApi(body);
}

function callAuthorizationApi(body) {
    let xhr = new XMLHttpRequest();
    xhr.open("POST", TOKEN, true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.setRequestHeader('Authorization', 'Basic ' + btoa(client_id + ":" + client_secret));
    xhr.send(body);
    xhr.onload = handleAuthorizationResponse;
}

function handleAuthorizationResponse() {
    if (this.status == 200) {
        var data = JSON.parse(this.responseText);
        if (data.access_token != undefined) {
            access_token = data.access_token;
            localStorage.setItem("access_token", access_token);
        }
        if (data.refresh_token != undefined) {
            refresh_token = data.refresh_token;
            localStorage.setItem("refresh_token", refresh_token);
        }
        onPageLoad();
    }
}

function displayTopArtists() {
    getTopArtists().then(topArtists => {
        const artistsContainer = document.getElementById("artistsContainer");
        if (!artistsContainer) return;

        // Create header element
        const header = document.createElement("h2");
        header.textContent = "Select Your Favorite Artists";
        header.classList.add("artists-header");

        // Get the parent element of artistsContainer
        const parentElement = artistsContainer.parentElement;

        // Insert the header before the artistsContainer
        parentElement.insertBefore(header, artistsContainer);

        // Clear existing content
        artistsContainer.innerHTML = "";

        // Create elements for each artist
        topArtists.forEach(artist => {
            const artistElement = document.createElement("div");
            artistElement.classList.add("artist");
            artistElement.dataset.artistName = artist.name; // Store artist name as dataset

            const nameElement = document.createElement("div");
            nameElement.textContent = artist.name;
            nameElement.classList.add("artist-name");

            const imageElement = document.createElement("img");
            if (artist.images.length > 0) {
                imageElement.src = artist.images[0].url; // Use the first image
            }
            imageElement.classList.add("artist-image");

            // Add click event listener to artist element
            artistElement.addEventListener("click", () => {
                toggleArtistSelection(artistElement, artist.name);
            });

            // Append elements to the container
            artistElement.appendChild(imageElement);
            artistElement.appendChild(nameElement);
            artistsContainer.appendChild(artistElement);
        });
    }).catch(error => {
        console.error("Error fetching and displaying top artists:", error);
    });
}

function toggleArtistSelection(artistElement, artistName) {
    if (selectedArtists.includes(artistName)) {
        // Artist is already selected, remove from array and reset style
        const index = selectedArtists.indexOf(artistName);
        if (index > -1) {
            selectedArtists.splice(index, 1);
        }
        artistElement.classList.remove("selected");
    } else {
        // Artist is not selected, add to array and set style
        selectedArtists.push(artistName);
        artistElement.classList.add("selected");
    }

    console.log("Selected Artists:", selectedArtists);
}

// Call init function on page load if access token is available
window.onload = function () {
    let code = getCode();
    if (code) {
        fetchAccessToken(code);
    }
};
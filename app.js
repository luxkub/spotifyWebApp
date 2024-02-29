var redirect_uri = "YOUR REDIRECT URI HERE";
var client_id = 'YOUR CLIENT ID HERE';
var client_secret = 'YOUR CLIENT SECRET HERE';
var access_token = null;
var refresh_token = null;
var currentPlaylist = "";
var savedTracks = [];
var allsavedTracks = [];
var savedTracksIds = [];
var selectedArtists = []; // Array to store selected artist names
var nextBatchLength = 0;
var ArtistTracks = [];
var playlistTracksIds = [];

const AUTHORIZE = "https://accounts.spotify.com/authorize";
const TOKEN = "https://accounts.spotify.com/api/token";
const loading = document.getElementById("loading");
const progress = document.getElementById("progress");
const createPlaylistButton = document.getElementById("createPlaylistButton");
const artistsContainer = document.getElementById("artistsContainer");

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

async function getTopArtists() {
    const artists = (await fetchWebApi(
        'v1/me/top/artists?time_range=long_term&limit=20', 'GET'
    )).items;
    return artists;
}

async function createPlaylist(tracksUri) {
    try {
        const { id: user_id } = await fetchWebApi('v1/me', 'GET');

        const playlist = await fetchWebApi(
            `v1/users/${user_id}/playlists`, 'POST', {
            "name": "For you",
            "description": generatePlaylistDescription(selectedArtists),
            "public": false
        },
        );

        if (!playlist || !playlist.id) {
            throw new Error("Playlist ID not found");
        }

        // Convert tracks URIs to objects with URIs
        const tracks = tracksUri.map(uri => ({ "uri": uri }));

        // Add tracks one by one to ensure they are added sequentially
        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            await fetchWebApi(
                `v1/playlists/${playlist.id}/tracks`,
                'POST',
                { "uris": [track.uri] }, // Each track should be added as an array
                localStorage.getItem("access_token")
            );
        }

        return playlist;
    } catch (error) {
        console.error("Error creating playlist:", error);
        throw error;
    }
}

async function getSavedTracks(offset = 0) {
    const response = await fetchWebApi(
        `v1/me/tracks?limit=50&offset=${offset}`, 'GET'
    );

    const tracks = response.items;
    tracks.forEach(item => {
        const track = item.track; // Access the 'track' object
    });

    console.log("Saved Songs:", tracks);
    nextBatchLength = tracks.length; // Store the length of the next batch

    return tracks;
}

async function createPlaylist(tracksUri) {
    try {
        const { id: user_id } = await fetchWebApi('v1/me', 'GET');

        const playlist = await fetchWebApi(
            `v1/users/${user_id}/playlists`, 'POST', {
            "name": "For you",
            "description": generatePlaylistDescription(selectedArtists),
            "public": false
        },
        );

        if (!playlist || !playlist.id) {
            throw new Error("Playlist ID not found");
        }

        // Convert tracks URIs to objects with URIs
        const tracks = tracksUri.map(uri => ({ "uri": uri }));

        // Add tracks one by one to ensure they are added sequentially
        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            await fetchWebApi(
                `v1/playlists/${playlist.id}/tracks`,
                'POST',
                { "uris": [track.uri] }, // Each track should be added as an array
                localStorage.getItem("access_token")
            );
        }

        return playlist;
    } catch (error) {
        console.error("Error creating playlist:", error);
        throw error;
    }
}

function generatePlaylistDescription(artists) {
    if (artists.length === 1) {
        return `A personalized playlist featuring ${artists[0]} and more`;
    } else if (artists.length === 2) {
        return `A personalized playlist featuring ${artists[0]}, ${artists[1]}, and more`;
    } else {
        return `A personalized playlist featuring ${artists[0]}, ${artists[1]}, ${artists[2]} and more`;

    }
}

async function getSavedTracks(offset = 0) {
    const response = await fetchWebApi(
        `v1/me/tracks?limit=50&offset=${offset}`, 'GET'
    );

    const tracks = response.items;
    tracks.forEach(item => {
        const track = item.track; // Access the 'track' object
    });

    console.log("Saved Songs:", tracks);
    nextBatchLength = tracks.length; // Store the length of the next batch

    return tracks;
}

async function init() {
    // Scroll to the top of the page
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const header = document.querySelector(".artists-header");
    header.style.display = "none";
    createPlaylistButton.style.display = "none";
    artistsContainer.style.display = "none";
    loading.style.display = "block";
    progress.style.display = "block";
    console.log("Fetching saved songs...");
    let offset = 0; // Initialize offset
    allsavedTracks = await getSavedTracks(offset); // Fetch first set of songs

    // Continue fetching until we get less than 50 songs or reach 2000
    while (nextBatchLength >= 1 && allsavedTracks.length < 2000) {
        offset += 50; // Increment offset
        const nextBatch = await getSavedTracks(offset); // Fetch next batch of songs
        allsavedTracks = allsavedTracks.concat(nextBatch); // Combine batches
    }

    // Limit to first 2000 tracks
    allsavedTracks = allsavedTracks.slice(0, 2000);

    console.log("All Saved Songs (up to 2000):", allsavedTracks); // Log all saved songs

    // Filter saved tracks based on selected artists
    const selectedTracks = allsavedTracks.filter(track => {
        return selectedArtists.includes(track.track.artists[0].name);
    });

    console.log("Selected Tracks:", selectedTracks); // Log selected tracks

    // Create a map to store all tracks by each selected artist
    const artistTracksMap = new Map();
    selectedArtists.forEach(artist => {
        const tracksByArtist = selectedTracks.filter(track => track.track.artists[0].name === artist).map(track => track.track);
        artistTracksMap.set(artist, tracksByArtist);
    });

    console.log("Artist Tracks Map:", artistTracksMap); // Log artist tracks map

    // Clear existing playlistTracksIds
    playlistTracksIds = [];

    for (const [artist, tracks] of artistTracksMap) {
        // Get 3 random tracks from the artist's saved tracks
        const randomArtistTracks = getRandomTracks(tracks, 3);
        console.log("Random Tracks for", artist, ":", randomArtistTracks);

        for (const track of randomArtistTracks) {
            console.log(`${track.name} by ${track.artists.map(artist => artist.name).join(', ')}`);

            // Get recommendations for each random track
            const recommendations = await getRecommendations(track.id);
            if (recommendations.length > 0) {
                const recommendedTrack = recommendations[0]; // Get the first recommendation
                console.log("Recommended Track for", track.id, ":", recommendedTrack);
                playlistTracksIds.push(recommendedTrack.id); // Add recommended track ID to playlistTracksIds
            }
        }

        // Add random track IDs to playlistTracksIds
        playlistTracksIds.push(...randomArtistTracks.map(track => track.id));
    }

    console.log("Playlist Tracks IDs before shuffle:", playlistTracksIds); // Log playlist tracks IDs before shuffle

    // Shuffling the playlistTracksIds array
    shuffleArray(playlistTracksIds);

    console.log("Playlist Tracks IDs after shuffle:", playlistTracksIds); // Log playlist tracks IDs after shuffle

    // Creating playlist with playlistTracksIds
    const tracksUri = playlistTracksIds.map(trackId => `spotify:track:${trackId}`);

    // Create a playlist with the combined tracks
    const createdPlaylist = await createPlaylist(tracksUri);
    console.log("Created Playlist:", createdPlaylist);

    loading.style.display = "none";
    progress.style.display = "none";

    // Display the playlist
    const playlistContainer = document.getElementById("playlistContainer");
    if (playlistContainer) {
        const playlistId = createdPlaylist.id; // Assuming createdPlaylist has the playlist ID
        const iframe = document.createElement("iframe");
        iframe.title = "Spotify Embed: Recommendation Playlist";
        iframe.src = `https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`;
        iframe.width = "100%";
        iframe.height = "100%";
        iframe.style.minHeight = "360px";
        iframe.frameBorder = "0";
        iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
        iframe.loading = "lazy";

        playlistContainer.appendChild(iframe);
    }
}

async function getRecommendations(trackId) {
    // Fetching recommendations based on a track
    const recommendations = await fetchWebApi(
        `v1/recommendations?limit=1&seed_tracks=${trackId}`, 'GET'
    );
    return recommendations.tracks;
}

async function getRecommendationsForArtist(artistTracks) {
    // Get random tracks from the artist's saved tracks
    const randomTracks = getRandomTracks(artistTracks, 3); // Get 3 random tracks
    return randomTracks;
}

function getRandomTracks(tracks, count) {
    if (tracks.length <= count) {
        return tracks;
    }
    const shuffled = tracks.sort(() => 0.5 - Math.random()); // Shuffle the array
    return shuffled.slice(0, count); // Get the first 'count' items
}

// Function to shuffle array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
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

    if (selectedArtists.length >= 1) {
        createPlaylistButton.style.display = "block";
    } else {
        createPlaylistButton.style.display = "none";
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

function redirectToHomePage() {
    window.location.href = "YOUR REDIRECT URI HERE";
}
import {useEffect, useState} from 'react';
import {request} from '../api';
import {mediaForDestination} from './media';

// Caché en memoria compartida por todas las tarjetas, fichas y mosaicos.
// Evita repetir la misma consulta de Unsplash cuando una ciudad aparece en
// varias partes de la interfaz durante la misma sesión.
const cache = new Map();
function cached(key) {
 const record=cache.get(key);
 if(record&&record.expiresAt<=Date.now()){cache.delete(key);return null;}
 return record;
}

const emptyState = () => ({
 status: 'empty', source: 'fallback', loading: false, photos: [],
 hero: null, card: null, gallery: [], message: ''
});

const loadingState = () => ({
 status: 'loading', source: '', loading: true, photos: [],
 hero: null, card: null, gallery: [], message: ''
});

function localState(destination) {
 const media = mediaForDestination(destination);
 if (media) {
  return {
   status: 'local', source: 'local', loading: false, photos: [],
   hero: media.hero || null,
   card: media.card || media.hero || null,
   gallery: media.gallery || [],
   message: ''
  };
 }
 // Un destino guardado con photo_url propia se considera imagen local.
 if (destination?.photo_url) {
  const photo = {
   src: destination.photo_url,
   alt: `${destination.name}, ${destination.region}`,
   author: null, authorUrl: null, photoUrl: null
  };
  return {
   status: 'local', source: 'db', loading: false, photos: [],
   hero: photo, card: photo, gallery: [], message: ''
  };
 }
 return null;
}

function normalizePhoto(photo, destination) {
 return {
  id: photo.id,
  src: photo.regularUrl || photo.smallUrl,
  alt: photo.alt || `Fotografía de referencia de ${destination.name}`,
  author: photo.author || 'Autor de Unsplash',
  authorUrl: photo.authorUrl || 'https://unsplash.com',
  photoUrl: photo.photoUrl || 'https://unsplash.com',
  source: 'unsplash'
 };
}

export function destinationPhotoKey(destination) {
 return [destination?.id || '', destination?.name || '', destination?.region || '', destination?.country || ''].join('|');
}

function fetchDestinationPhotos(destination) {
 const key = destinationPhotoKey(destination);
 const existing = cached(key);
 if (existing) return existing.promise;

 const record = {promise: null, state: null, expiresAt:Date.now()+30*60_000};
 record.promise = request(
   `/photos?name=${encodeURIComponent(destination.name)}&region=${encodeURIComponent(destination.region || '')}&country=${encodeURIComponent(destination.country || '')}&type=${encodeURIComponent(destination.place_type || 'city')}&limit=6`
 ).then(response => {
  const photos = (response.photos || [])
   .map(photo => normalizePhoto(photo, destination))
   .filter(photo => photo.src);
  if (!photos.length) {
   return {
    ...emptyState(),
    source: 'fallback',
    message: response.message || `No se encontraron fotografías de ${destination.name}. Se muestra una imagen de referencia.`
   };
  }
  return {
   status: 'ready', source: 'unsplash', loading: false, photos,
   hero: photos[0], card: photos[0], gallery: photos.slice(1, 5),
   message: response.message || ''
  };
 }).catch(error => ({
  ...emptyState(),
  source: 'fallback',
  message: error.message || 'No se pudieron consultar las fotografías en este momento.'
 }));
 record.promise.then(state => { record.state = state; record.expiresAt=Date.now()+(state.status==='ready'?30*60_000:30_000); });
 cache.set(key, record);
 if(cache.size>200)cache.delete(cache.keys().next().value);
 return record.promise;
}

export function useDestinationPhotos(destination) {
 const key = destinationPhotoKey(destination);
 const local = localState(destination);
 const [entry, setEntry] = useState(() => ({
  key,
  state: local || cached(key)?.state || (destination ? loadingState() : emptyState())
 }));

 useEffect(() => {
  let active = true;
  if (!destination) {
   setEntry({key, state: emptyState()});
   return () => { active = false; };
  }
  const localMedia = localState(destination);
  if (localMedia) {
   setEntry({key, state: localMedia});
   return () => { active = false; };
  }
  const record = cached(key);
  if (record?.state) {
   setEntry({key, state: record.state});
   return () => { active = false; };
  }
  setEntry({key, state: loadingState()});
  fetchDestinationPhotos(destination).then(next => {
   if (active) setEntry({key, state: next});
  });
  return () => { active = false; };
 }, [key]);

 if (!destination) return emptyState();
 if (local) return local;
 // Nunca reutiliza el estado de otra ciudad mientras cambia de ficha.
 if (entry.key === key) return entry.state;
 return cached(key)?.state || loadingState();
}

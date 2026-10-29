// Fotografías verificadas de Unsplash para el catálogo real.
// Los archivos se sirven localmente para evitar imágenes incorrectas o enlaces roídos.
const photos = {
  "hero-andes": {
    "src": "/images/hero-andes.webp",
    "alt": "river between mountain",
    "author": "Wolfgang Lutz",
    "authorUrl": "https://unsplash.com/@wolfi",
    "photoUrl": "https://unsplash.com/photos/river-between-mountain-qTHRF2rvGjA"
  },
  "auth-portrait": {
    "src": "/images/auth-portrait.webp",
    "alt": "An older man in a patterned vest and cap holding a woven textile",
    "author": "Gustavo Leighton",
    "authorUrl": "https://unsplash.com/@gustavoleighton",
    "photoUrl": "https://unsplash.com/photos/man-in-patterned-vest-and-textile-PeaxJvRPxfE"
  },
  "weaving": {
    "src": "/images/weaving.webp",
    "alt": "Woman weaving colorful fabric on a loom",
    "author": "Sophia Simoes",
    "authorUrl": "https://unsplash.com/@sophiasimoes",
    "photoUrl": "https://unsplash.com/photos/woman-weaving-colorful-fabric-on-a-loom-wdvpxIKah4I"
  },
  "ceviche": {
    "src": "/images/ceviche.webp",
    "alt": "ceviche on white bowl",
    "author": "Jose Ruales",
    "authorUrl": "https://unsplash.com/@jaruales",
    "photoUrl": "https://unsplash.com/photos/ceviche-on-white-bowl-XVWtfPzjNpI"
  },
  "destinations/machu-picchu": {
    "src": "/images/destinations/machu-picchu.webp",
    "alt": "The ancient stone ruins of Machu Picchu nestled among lush green mountains in Peru",
    "author": "Eddie Kiszka",
    "authorUrl": "https://unsplash.com/@eddiekiszka",
    "photoUrl": "https://unsplash.com/photos/machu-picchu-stone-ruins-in-peru-rFESpq5MMTg"
  },
  "destinations/machu-picchu-card": {
    "src": "/images/destinations/machu-picchu-card.webp",
    "alt": "The ancient stone ruins of Machu Picchu nestled among lush green mountains in Peru",
    "author": "Eddie Kiszka",
    "authorUrl": "https://unsplash.com/@eddiekiszka",
    "photoUrl": "https://unsplash.com/photos/machu-picchu-stone-ruins-in-peru-rFESpq5MMTg"
  },
  "destinations/machu-picchu-2": {
    "src": "/images/destinations/machu-picchu-2.webp",
    "alt": "machu picchu ruins among misty mountains",
    "author": "Willian Justen de Vasconcellos",
    "authorUrl": "https://unsplash.com/@willianjusten",
    "photoUrl": "https://unsplash.com/photos/machu-picchu-ruins-among-misty-mountains-4hMET7vYTAQ"
  },
  "destinations/machu-picchu-3": {
    "src": "/images/destinations/machu-picchu-3.webp",
    "alt": "aerial view of green mountains during daytime",
    "author": "Victor He",
    "authorUrl": "https://unsplash.com/@victorhwn725",
    "photoUrl": "https://unsplash.com/photos/aerial-view-of-green-mountains-during-daytime-yam1KMv0SgQ"
  },
  "destinations/machu-picchu-4": {
    "src": "/images/destinations/machu-picchu-4.webp",
    "alt": "The sun shines on the ruins of a mountain",
    "author": "Ed Wingate",
    "authorUrl": "https://unsplash.com/@ed_wingate",
    "photoUrl": "https://unsplash.com/photos/the-sun-shines-on-the-ruins-of-a-mountain-kxkhsVY8-vU"
  },
  "destinations/cusco": {
    "src": "/images/destinations/cusco.webp",
    "alt": "people walking near Cusco Cathedral in Peru under white and blue sky",
    "author": "Raul Varela",
    "authorUrl": "https://unsplash.com/@raulvarela",
    "photoUrl": "https://unsplash.com/photos/people-walking-near-cusco-cathedral-in-peru-under-white-and-blue-sky-dgVZBjk2lwc"
  },
  "destinations/cusco-card": {
    "src": "/images/destinations/cusco-card.webp",
    "alt": "people walking near Cusco Cathedral in Peru under white and blue sky",
    "author": "Raul Varela",
    "authorUrl": "https://unsplash.com/@raulvarela",
    "photoUrl": "https://unsplash.com/photos/people-walking-near-cusco-cathedral-in-peru-under-white-and-blue-sky-dgVZBjk2lwc"
  },
  "destinations/cusco-2": {
    "src": "/images/destinations/cusco-2.webp",
    "alt": "a large city with many buildings",
    "author": "Mauro Lima",
    "authorUrl": "https://unsplash.com/@limamauro23",
    "photoUrl": "https://unsplash.com/photos/a-large-city-with-many-buildings-bz4Bu_SAmz0"
  },
  "destinations/cusco-3": {
    "src": "/images/destinations/cusco-3.webp",
    "alt": "a group of people walking around a large building",
    "author": "Ken S",
    "authorUrl": "https://unsplash.com/@chum94555",
    "photoUrl": "https://unsplash.com/photos/a-group-of-people-walking-around-a-large-building-SyfCF06QyMM"
  },
  "destinations/cusco-4": {
    "src": "/images/destinations/cusco-4.webp",
    "alt": "woman in store with display of assorted shirts and textiles",
    "author": "Peter Livesey",
    "authorUrl": "https://unsplash.com/@plivesey",
    "photoUrl": "https://unsplash.com/photos/woman-in-store-with-display-of-assorted-shirts-and-textiles-WEME5LOrLpE"
  },
  "destinations/valle-sagrado": {
    "src": "/images/destinations/valle-sagrado.webp",
    "alt": "beige houses in foot of green grassy hill",
    "author": "Silvia Fang",
    "authorUrl": "https://unsplash.com/@dq_silviaaa",
    "photoUrl": "https://unsplash.com/photos/beige-houses-in-foot-of-green-grassy-hill-Oa_1tVrJjXs"
  },
  "destinations/valle-sagrado-card": {
    "src": "/images/destinations/valle-sagrado-card.webp",
    "alt": "beige houses in foot of green grassy hill",
    "author": "Silvia Fang",
    "authorUrl": "https://unsplash.com/@dq_silviaaa",
    "photoUrl": "https://unsplash.com/photos/beige-houses-in-foot-of-green-grassy-hill-Oa_1tVrJjXs"
  },
  "destinations/valle-sagrado-2": {
    "src": "/images/destinations/valle-sagrado-2.webp",
    "alt": "green grass field near mountain under blue sky during daytime",
    "author": "Giorgia Doglioni",
    "authorUrl": "https://unsplash.com/@gio_aroundtheworld",
    "photoUrl": "https://unsplash.com/photos/green-grass-field-near-mountain-under-blue-sky-during-daytime-G2zjqUDkYSQ"
  },
  "destinations/valle-sagrado-3": {
    "src": "/images/destinations/valle-sagrado-3.webp",
    "alt": "green grass field during daytime",
    "author": "Isabelle Truong",
    "authorUrl": "https://unsplash.com/@isabelle_sydney",
    "photoUrl": "https://unsplash.com/photos/green-grass-field-during-daytime-qJEGKc6XoTk"
  },
  "destinations/valle-sagrado-4": {
    "src": "/images/destinations/valle-sagrado-4.webp",
    "alt": "rocky mountains",
    "author": "Paul Daly",
    "authorUrl": "https://unsplash.com/@daly85",
    "photoUrl": "https://unsplash.com/photos/rocky-mountains-hQljmSHzn4E"
  },
  "destinations/arequipa": {
    "src": "/images/destinations/arequipa.webp",
    "alt": "A panoramic view of a city with a mountain in the background",
    "author": "Mayur Arvind",
    "authorUrl": "https://unsplash.com/@mayurarvind",
    "photoUrl": "https://unsplash.com/photos/a-panoramic-view-of-a-city-with-a-mountain-in-the-background-hpc4DFyjY40"
  },
  "destinations/arequipa-card": {
    "src": "/images/destinations/arequipa-card.webp",
    "alt": "A panoramic view of a city with a mountain in the background",
    "author": "Mayur Arvind",
    "authorUrl": "https://unsplash.com/@mayurarvind",
    "photoUrl": "https://unsplash.com/photos/a-panoramic-view-of-a-city-with-a-mountain-in-the-background-hpc4DFyjY40"
  },
  "destinations/arequipa-2": {
    "src": "/images/destinations/arequipa-2.webp",
    "alt": "a large cathedral with a clock tower in the background",
    "author": "Hongbin",
    "authorUrl": "https://unsplash.com/@hbsun2013",
    "photoUrl": "https://unsplash.com/photos/a-large-cathedral-with-a-clock-tower-in-the-background-qgZRY6QF_Hc"
  },
  "destinations/arequipa-3": {
    "src": "/images/destinations/arequipa-3.webp",
    "alt": "a view of a mountain through an arch",
    "author": "Hongbin",
    "authorUrl": "https://unsplash.com/@hbsun2013",
    "photoUrl": "https://unsplash.com/photos/a-view-of-a-mountain-through-an-arch-qiGBTN_rLuI"
  },
  "destinations/arequipa-4": {
    "src": "/images/destinations/arequipa-4.webp",
    "alt": "white and brown concrete building near green trees and mountain during daytime",
    "author": "Megan Kotlus",
    "authorUrl": "https://unsplash.com/@mkotlus07",
    "photoUrl": "https://unsplash.com/photos/white-and-brown-concrete-building-near-green-trees-and-mountain-during-daytime-XHoVvW8VkzY"
  },
  "destinations/lago-titicaca": {
    "src": "/images/destinations/lago-titicaca.webp",
    "alt": "brown wooden houses on green grass field during daytime",
    "author": "Deb Dowd",
    "authorUrl": "https://unsplash.com/@fin777",
    "photoUrl": "https://unsplash.com/photos/brown-wooden-houses-on-green-grass-field-during-daytime-vSTppJykEhY"
  },
  "destinations/lago-titicaca-card": {
    "src": "/images/destinations/lago-titicaca-card.webp",
    "alt": "brown wooden houses on green grass field during daytime",
    "author": "Deb Dowd",
    "authorUrl": "https://unsplash.com/@fin777",
    "photoUrl": "https://unsplash.com/photos/brown-wooden-houses-on-green-grass-field-during-daytime-vSTppJykEhY"
  },
  "destinations/lago-titicaca-2": {
    "src": "/images/destinations/lago-titicaca-2.webp",
    "alt": "calm body of water",
    "author": "Guido Coppa",
    "authorUrl": "https://unsplash.com/@gcoppa",
    "photoUrl": "https://unsplash.com/photos/calm-body-of-water-Yl01mEIrlus"
  },
  "destinations/lago-titicaca-3": {
    "src": "/images/destinations/lago-titicaca-3.webp",
    "alt": "a body of water with mountains in the background",
    "author": "Juan Orestes",
    "authorUrl": "https://unsplash.com/@juankiddy",
    "photoUrl": "https://unsplash.com/photos/a-body-of-water-with-mountains-in-the-background-h7DYo3Uc4xQ"
  },
  "destinations/lago-titicaca-4": {
    "src": "/images/destinations/lago-titicaca-4.webp",
    "alt": "plains across body of water and clouds",
    "author": "Mikołaj Idziak",
    "authorUrl": "https://unsplash.com/@mikidz",
    "photoUrl": "https://unsplash.com/photos/plains-across-body-of-water-and-clouds-OLWDxcqz5C4"
  },
  "destinations/paracas": {
    "src": "/images/destinations/paracas.webp",
    "alt": "ocean near mountains landscape photo",
    "author": "Matthijs Idema",
    "authorUrl": "https://unsplash.com/@matthijsidema",
    "photoUrl": "https://unsplash.com/photos/ocean-near-mountains-landscape-photo-C87mknr0YAs"
  },
  "destinations/paracas-card": {
    "src": "/images/destinations/paracas-card.webp",
    "alt": "ocean near mountains landscape photo",
    "author": "Matthijs Idema",
    "authorUrl": "https://unsplash.com/@matthijsidema",
    "photoUrl": "https://unsplash.com/photos/ocean-near-mountains-landscape-photo-C87mknr0YAs"
  },
  "destinations/paracas-2": {
    "src": "/images/destinations/paracas-2.webp",
    "alt": "white and orange boat on sea near gray rock formation during daytime",
    "author": "WILLIAN REIS",
    "authorUrl": "https://unsplash.com/@wriopomba",
    "photoUrl": "https://unsplash.com/photos/white-and-orange-boat-on-sea-near-gray-rock-formation-during-daytime-Nslb0mtKjtk"
  },
  "destinations/paracas-3": {
    "src": "/images/destinations/paracas-3.webp",
    "alt": "black seal on brown rock near body of water during daytime",
    "author": "Ryder Damen",
    "authorUrl": "https://unsplash.com/@ryderdamen",
    "photoUrl": "https://unsplash.com/photos/black-seal-on-brown-rock-near-body-of-water-during-daytime-Wf44McOeNR8"
  },
  "destinations/paracas-4": {
    "src": "/images/destinations/paracas-4.webp",
    "alt": "flock of birds",
    "author": "Loïc Mermilliod",
    "authorUrl": "https://unsplash.com/@loacfr",
    "photoUrl": "https://unsplash.com/photos/flock-of-birds-o1U9GHyP0W4"
  },
  "destinations/huaraz": {
    "src": "/images/destinations/huaraz.webp",
    "alt": "white boat on body of water near mountain during daytime",
    "author": "John Portella",
    "authorUrl": "https://unsplash.com/@johnportella",
    "photoUrl": "https://unsplash.com/photos/white-boat-on-body-of-water-near-mountain-during-daytime-jWOsFhW_v8w"
  },
  "destinations/huaraz-card": {
    "src": "/images/destinations/huaraz-card.webp",
    "alt": "white boat on body of water near mountain during daytime",
    "author": "John Portella",
    "authorUrl": "https://unsplash.com/@johnportella",
    "photoUrl": "https://unsplash.com/photos/white-boat-on-body-of-water-near-mountain-during-daytime-jWOsFhW_v8w"
  },
  "destinations/huaraz-2": {
    "src": "/images/destinations/huaraz-2.webp",
    "alt": "selective focus photography of white animal",
    "author": "Paul Lequay",
    "authorUrl": "https://unsplash.com/@paulequay",
    "photoUrl": "https://unsplash.com/photos/selective-focus-photography-of-white-animal-73FOXT1DvjI"
  },
  "destinations/huaraz-3": {
    "src": "/images/destinations/huaraz-3.webp",
    "alt": "snow covered mountain under blue sky during daytime",
    "author": "Edward Blanco",
    "authorUrl": "https://unsplash.com/@leblanc_",
    "photoUrl": "https://unsplash.com/photos/snow-covered-mountain-under-blue-sky-during-daytime-04g9sxNuj8M"
  },
  "destinations/huaraz-4": {
    "src": "/images/destinations/huaraz-4.webp",
    "alt": "a boat sitting on top of a lake surrounded by mountains",
    "author": "gonzalo iglesias",
    "authorUrl": "https://unsplash.com/@pakatnamu",
    "photoUrl": "https://unsplash.com/photos/a-boat-sitting-on-top-of-a-lake-surrounded-by-mountains-R9V05XTW-cE"
  },
  "destinations/lima": {
    "src": "/images/destinations/lima.webp",
    "alt": "city on island during day",
    "author": "Aarom Ore",
    "authorUrl": "https://unsplash.com/@creatorsproduce",
    "photoUrl": "https://unsplash.com/photos/city-on-island-during-day-Yrqyn1Gb80k"
  },
  "destinations/lima-card": {
    "src": "/images/destinations/lima-card.webp",
    "alt": "city on island during day",
    "author": "Aarom Ore",
    "authorUrl": "https://unsplash.com/@creatorsproduce",
    "photoUrl": "https://unsplash.com/photos/city-on-island-during-day-Yrqyn1Gb80k"
  },
  "destinations/lima-2": {
    "src": "/images/destinations/lima-2.webp",
    "alt": "beige concrete building under blue sky and white clouds during daytime",
    "author": "Eduardo Garcia",
    "authorUrl": "https://unsplash.com/@eduardoxxvlll",
    "photoUrl": "https://unsplash.com/photos/beige-concrete-building-under-blue-sky-and-white-clouds-during-daytime-cRHwRTXodcw"
  },
  "destinations/lima-3": {
    "src": "/images/destinations/lima-3.webp",
    "alt": "road near body of water and buildings at daytime",
    "author": "Willian Justen de Vasconcellos",
    "authorUrl": "https://unsplash.com/@willianjusten",
    "photoUrl": "https://unsplash.com/photos/road-near-body-of-water-and-buildings-at-daytime-mZKEIRBStv4"
  }
};

const photo = key => photos[key];

export const siteMedia = {
  hero: photo('hero-andes', 'Río entre montañas nevadas de los Andes peruanos'),
  auth: photo('auth-portrait', 'Retrato de un hombre andino con textiles tradicionales'),
  weaving: photo('weaving', 'Manos tejiendo un textil andino en un telar'),
  ceviche: photo('ceviche', 'Ceviche peruano servido en un plato blanco')
};

export const destinationMedia = {
  'machu-picchu': {
    hero: photo('destinations/machu-picchu'),
    card: photo('destinations/machu-picchu-card'),
    gallery: [photo('destinations/machu-picchu-2'), photo('destinations/machu-picchu-3'), photo('destinations/machu-picchu-4')]
  },
  cusco: {
    hero: photo('destinations/cusco'),
    card: photo('destinations/cusco-card'),
    gallery: [photo('destinations/cusco-2'), photo('destinations/cusco-3'), photo('destinations/cusco-4')]
  },
  'valle-sagrado': {
    hero: photo('destinations/valle-sagrado'),
    card: photo('destinations/valle-sagrado-card'),
    gallery: [photo('destinations/valle-sagrado-2'), photo('destinations/valle-sagrado-3'), photo('destinations/valle-sagrado-4')]
  },
  arequipa: {
    hero: photo('destinations/arequipa'),
    card: photo('destinations/arequipa-card'),
    gallery: [photo('destinations/arequipa-2'), photo('destinations/arequipa-3'), photo('destinations/arequipa-4')]
  },
  'lago-titicaca': {
    hero: photo('destinations/lago-titicaca'),
    card: photo('destinations/lago-titicaca-card'),
    gallery: [photo('destinations/lago-titicaca-2'), photo('destinations/lago-titicaca-3'), photo('destinations/lago-titicaca-4')]
  },
  paracas: {
    hero: photo('destinations/paracas'),
    card: photo('destinations/paracas-card'),
    gallery: [photo('destinations/paracas-2'), photo('destinations/paracas-3'), photo('destinations/paracas-4')]
  },
  huaraz: {
    hero: photo('destinations/huaraz'),
    card: photo('destinations/huaraz-card'),
    gallery: [photo('destinations/huaraz-2'), photo('destinations/huaraz-3'), photo('destinations/huaraz-4')]
  },
  lima: {
    hero: photo('destinations/lima'),
    card: photo('destinations/lima-card'),
    gallery: [photo('destinations/lima-2'), photo('destinations/lima-3'), siteMedia.ceviche]
  }
};

export const experienceMedia = {
  Cultura: destinationMedia.cusco.card,
  Naturaleza: destinationMedia['valle-sagrado'].card,
  Aventura: destinationMedia.huaraz.card,
  Ciudad: destinationMedia.lima.card
};

export function mediaForDestination(destination) {
  return destinationMedia[destination?.id] || null;
}

export function heroForDestination(destination) {
  return mediaForDestination(destination)?.hero || {
    src: destination?.photo_url || null,
    alt: destination ? `${destination.name}, ${destination.region}` : siteMedia.hero.alt,
    author: null,
    authorUrl: null,
    photoUrl: null
  };
}

export function galleryForDestination(destination) {
  return mediaForDestination(destination)?.gallery || [];
}

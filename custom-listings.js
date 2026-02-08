// Custom SCP listings that are not part of the imported feeds.
// Loaded before app.js so the app can merge them into the catalog.
(function () {
  const list = Array.isArray(window.customPropertyData) ? window.customPropertyData : [];

  // Vacation rental: SpanishCoastProperties.com
  list.push({
    id: 'SCP-VR-0001',
    ref: 'SCP-VR-0001',
    price: 0,
    currency: 'EUR',
    listing_mode: 'rent',
    rent_price: 75,
    rent_period: 'night',
    type: 'Town House',
    town: 'Torrevieja',
    province: 'Alicante',
    beds: 2,
    baths: 2,
    surface_area: { built: 67, plot: 0 },
    latitude: 37.9808,
    longitude: -0.6695,
    // Store canonical listing URL for sharing/verification.
    source_url: 'https://spanishcoastproperties.com/properties/sunny-2br-home-with-private-patio-pool-and-beach/',
    description: [
      'Vacation rental.',
      'Sunny 2-bedroom home with private patio and access to a large communal pool.',
      'Very close to Playa del Cura and Playa de Los Locos (around a 10-minute walk).',
      'Air conditioning, Wi‑Fi, fully equipped kitchen, and easy street parking nearby.',
      'Perfect for couples or families looking for a relaxed base in Torrevieja.'
    ].join('\n'),
    features: [
      'Pool: Communal',
      'Air Conditioning',
      'Wi‑Fi',
      'Walk to beach',
      'Private patio'
    ],
    images: [
      // Use a known working WP thumbnail as the first image (others are best-effort candidates).
      'https://spanishcoastproperties.com/wp-content/uploads/2025/06/6-4-525x328.jpg',
      'https://spanishcoastproperties.com/wp-content/uploads/2025/06/6-4.jpg',
      'https://spanishcoastproperties.com/wp-content/uploads/2025/06/6-1.jpg'
    ]
  });

  window.customPropertyData = list;
})();


// ---------------------------------------------------------------
//  Digital Ganpati Pandal – configuration
//  Edit this file only; no need to touch app.js.
// ---------------------------------------------------------------
window.PANDAL_CONFIG = {
  version: 3,   // bump this whenever a model/asset file is replaced, so browsers don't reuse a cached copy

  // Banner text (from the real banner in the reference photos)
  mandalName:   'पूर्वांचल महाराष्ट्र मंडळ (रजि.)',
  mandalNameEn: 'Purvanchal Maharashtra Mandal (Regd.)',
  eventTitle:   'गणेश उत्सव 2026',
  eventDates:   'दिनांक 14 सितम्बर 2026, दिन: सोमवार से शुक्रवार 18 सितम्बर 2026 तक',   // <-- confirm the 2026 dates
  venue:        'आनन्द भवन, राम मन्दिर, आनन्द विहार, दिल्ली-110092',
  establishedYear: 1984,

  // Donation ------------------------------------------------------
  // The QR in the hall is generated from this UPI id (scannable with
  // Paytm / PhonePe / GPay). Clicking the QR stand opens the UPI link.
  upi: {
    id:        'mandal@paytm',                       // <-- change to the mandal's UPI id
    payeeName: 'Purvanchal Maharashtra Mandal',
    note:      'Ganesh Utsav Donation',
  },
  // Optional: a Paytm payment link (https://p.paytm.me/...). If set, the
  // donate popup shows an extra "Open Paytm" button.
  paymentLink: '',

  // Real logo image (optional) – drawn onto the banner when present
  images: {
    // Mandal logo drawn onto the banner. logoCrop = fractions [x, y, w, h] of the image to use.
    logo: 'assets/images/logo.png',
    logoCrop: [0, 0, 1, 1],
  },

  // 3D models from Sketchfab -------------------------------------------
  // Run `node download-models.mjs` (needs SKETCHFAB_TOKEN, see README) to fetch the
  // free CC-BY ones into assets/models/<key>/scene.gltf. Each key falls back to a
  // built-in procedural version if the file is missing.
  //
  // The paid Store models you picked (not downloadable via API) are listed as
  // `store`: buy them on Sketchfab, download as glTF, unzip into the same folder,
  // and the app will use them automatically.
  models: {
    bigMurti:      { path: 'assets/models/bigMurti/model.glb', rotY: -Math.PI / 2,   // model faces +x; turn it toward the hall
                     uid: 'a93a83413e034b29803aed62577357c5',     // "Ganesha 3D" by lucas.rvdl (CC-BY)
                     credit: { title: 'Ganesha 3D', author: 'lucas.rvdl', url: 'https://sketchfab.com/3d-models/a93a83413e034b29803aed62577357c5' } },
    smallMurti:    { path: 'assets/models/smallMurti/model.glb',
                     uid: '0138e4b2676c44828cec10c1bb480aff',     // free: "Ganesh Color" by ankit5 (CC-BY)
                     store: 'cee84a1ca6994beeae3260c4a5bc95b5',   // your pick: "Lord Ganesha Hindu Deity 03" (Store)
                     credit: { title: 'Ganesh Color', author: 'ankit5', url: 'https://sketchfab.com/3d-models/0138e4b2676c44828cec10c1bb480aff' } },
    oilLamp:       { lite: false, path: 'assets/models/oilLamp/model.glb',
                     uid: '1fba4e5a5ac8410ca7235673a3f269ba',     // your pick: "Golden Oil Lamp" (CC-BY)
                     credit: { title: 'Golden Oil Lamp', author: 'Sketchfab author', url: 'https://sketchfab.com/3d-models/1fba4e5a5ac8410ca7235673a3f269ba' } },
    incenseBurner: { lite: false, path: 'assets/models/incenseBurner/model.glb',
                     uid: '69dbb96caea84dcab6ac8fa83af78ff9',     // free: low-poly incense burner by chiwei2333 (CC-BY)
                     store: 'd9fb34fab22e45d9915ecf4bbb6a44b3',   // your pick: "Incense Burner - Tubix" (Store)
                     credit: { title: 'Chinese Incense Burner', author: 'chiwei2333', url: 'https://sketchfab.com/3d-models/69dbb96caea84dcab6ac8fa83af78ff9' } },
    flowerPot:     { lite: false, path: 'assets/models/flowerPot/model.glb',
                     uid: 'e114ab027906482abe7daa04eef60e95',     // free: "Flower Pot" by topfrank2013 (CC-BY)
                     store: '2f0507e4c4b342e286e3dfde052508b6',   // your pick: "Stylized Flower Pot" (Store)
                     credit: { title: 'Flower Pot', author: 'topfrank2013', url: 'https://sketchfab.com/3d-models/e114ab027906482abe7daa04eef60e95' } },
    pujaThali:     { path: 'assets/models/pujaThali/model.glb',
                     uid: 'f195d91a298f4ed7a2581c9b0aebcc4b',     // your pick: "Puja Thali Set" by ALEXMOt (Free Standard)
                     credit: { title: 'Puja Thali Set', author: 'ALEXMOt', url: 'https://sketchfab.com/3d-models/f195d91a298f4ed7a2581c9b0aebcc4b' } },
    rosePot:       { lite: false, path: 'assets/models/rosePot/model.glb',
                     uid: 'b18150226582443aa0cfeeae531f3503',     // your pick: "Rose in a pot" (CC-BY)
                     credit: { title: 'Rose in a pot', author: 'Sketchfab author', url: 'https://sketchfab.com/3d-models/b18150226582443aa0cfeeae531f3503' } },
  },

  // Aarti playlist. Drop mp3 files into assets/aarti/ and list them here.
  aarti: [
    { title: 'Sukhkarta Dukhharta', src: 'assets/aarti/sukhkarta-dukhharta.mp3' },
  ],
};

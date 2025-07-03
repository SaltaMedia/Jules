const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// POST /api/products - Get product recommendations (protected)
router.post('/', auth, (req, res) => {
  const { query } = req.body;
  // Mock product data
  const products = [
    {
      name: 'Slim Fit White Oxford Shirt',
      brand: 'Uniqlo',
      price: '$29.90',
      url: 'https://www.uniqlo.com/us/en/products/E445678-000/00?colorDisplayCode=00',
      image: 'https://image.uniqlo.com/UQ/ST3/us/imagesgoods/445678/item/usgoods_00_445678.jpg'
    },
    {
      name: 'Classic Blue Jeans',
      brand: 'Levi\'s',
      price: '$59.50',
      url: 'https://www.levi.com/US/en_US/clothing/men/jeans/511-slim-fit-mens-jeans/p/045114406',
      image: 'https://lsco.scene7.com/is/image/lsco/045114406-front-pdp.jpg'
    }
  ];
  res.json({ query, products });
});

module.exports = router; 
DAS Farms product gallery system

What was added:
- Every product now has a gallery folder under images/products/<product_id>/
- Each folder contains:
  - main.*   -> primary image
  - alt-1.*  -> gallery image 2
  - alt-2.*  -> gallery image 3
- The product page now shows one main image and two thumbnails.

How to change images later:
1. Open data/product_gallery_manifest.csv
2. Find the product_id you want to change
3. Replace the files in images/products/<product_id>/
4. Keep the same filenames if possible

Current state:
- The gallery system is built and all products are organized for easy replacement.
- The current gallery images are seeded from the product images already in the site.

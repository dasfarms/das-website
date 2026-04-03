Common-name product URLs and image folders

What changed:
- Product page links now use the common plant name slug where available.
- Image folders under images/products/ now use the common-name slug.
- Product lookup still supports old legacy ids/slugs so older links keep working.

Example:
- Old URL: product.html?id=bxseam
- New URL: product.html?id=american-boxwood
- Old folder: images/products/bxseam/
- New folder: images/products/american-boxwood/

See data/common_name_url_folder_map.csv for the full mapping.

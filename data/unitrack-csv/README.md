# KATO Unitrack CSV exports from PDF

Source: `common_parts_namelist.pdf`, pages 1-6.

Files:

- `unitrack_pdf_full_catalog.csv` — human-readable catalog list based on the PDF pages. It includes app-native rows plus catalog-only rows for accessories/platforms that may not have complete geometry.
- `unitrack_pdf_app_native_all.csv` — importable by the planner's Parts Palette CSV importer. Uses the app schema exactly.
- `packs/basic_track.csv` — importable pack of simple track pieces.
- `packs/bridges_viaducts.csv` — importable pack of bridges and viaduct parts.
- `packs/stations_platforms_buildings.csv` — importable pack of station/platform/building parts.
- `packs/special_track_bumpers_expansion.csv` — importable pack of bumper tracks and expansion track.
- `packs/double_track.csv` — importable pack of Double secondary-kind parts.
- `packs/shapes.csv` — importable pack of custom shapes.

The app-native CSV header is:

`id,sku,name,kind,secondaryKinds,length,minLength,maxLength,radius,radius2,angle,diverging,trackCenters,color,bridgeStyle,isTerminal,width,depth,buildingStyle,shapeType,shapeWidth,shapeHeight,shapeSide,shapeDiameter,notes`

Import note: The app importer replaces the current palette with the CSV contents. Use Save/Load for the layout separately.

import { reachableBusStopsAreaAnalysis } from "./reachableBusStopsAreaAnalysis.js";
import { reachableStationsAreaAnalysis } from "./reachableStationsAreaAnalysis.js";


reachableBusStopsAreaAnalysis(35.6439, 139.6993, 100, false, 43200, 3600)
    .then(result => {
        console.log(result);
    });

/*
reachableStationsAreaAnalysis(35.686259, 139.782339, 500, false, 43200, 3600)
    .then(result => {
        console.log(result);
    });
*/

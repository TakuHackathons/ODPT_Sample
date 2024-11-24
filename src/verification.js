import { reachableBusAreaAnalysis } from "./reachableBusAreaAnalysis.js";


reachableBusAreaAnalysis(35.6439, 139.6993, 100, false, 43200, 3600)
    .then(result => {
        console.log(result);
    });
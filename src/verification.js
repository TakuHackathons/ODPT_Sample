import { reachableBusAreaAnalysis } from "./reachableBusAreaAnalysis.js";
import { reachableTrainAreaAnalysis } from "./reachableTrainAreaAnalysis.js";

/*
reachableBusAreaAnalysis(35.6439, 139.6993, 100, false, 43200, 3600)
    .then(result => {
        console.log(result);
    });
*/

reachableTrainAreaAnalysis(35.686259, 139.782339, 500, false, 43200, 3600)
    .then(result => {
        console.log(result);
    });

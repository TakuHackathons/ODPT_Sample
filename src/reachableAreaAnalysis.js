import axios from 'axios';
import dotenv from 'dotenv';


reachableAreaAnalysis(35.6439, 139.6993, 100, false, 43200, 3600)
    .then(result => {
        console.log(result);
    });


// lat: 緯度
// lon: 経度
// radius: 緯度、経度から半径何[m]を対象に探索するか（0〜4000[m]）
// isHoliday: 休日ならTrue
// departureTime: バス停・駅からの出発時刻（0:00からの経過時間（秒）で設定）
// reqiredTime: 出発（バス停・駅）から到着（バス停・駅）までの期待する許容時間（秒）を設定

async function reachableAreaAnalysis(lat, lon, radius, isHoliday, departureTime, requiredTime) {

    const baseUrl = "https://api-challenge2024.odpt.org/api/v4/";

    const apiKey = dotenv.config().parsed.API_KEY;

    // 平日か土日かを指定
    const calendar = isHoliday ? 'odpt.Calendar:Holiday' : 'odpt.Calendar:Weekday';


    // ①指定した地点の近辺にあるバス停情報を格納
    let busStopInfo = [];

    // ①指定した地点の近辺にあるバス停を取得するためのURL
    const getNearBusStopPoleURL = {
        method: 'get',
        maxBodyLength: Infinity,
        url: baseUrl + 'places/odpt:BusstopPole?lon=' + lon + '&lat=' + lat + '&radius=' + radius + '&acl:consumerKey=' + apiKey,
        headers: {}
    };

    // ①リクエスト
    await axios.request(getNearBusStopPoleURL)
        .then((response) => {
            //console.log(response.data);
            response.data.forEach(entry => {
                //console.log(entry);
                busStopInfo.push(
                    {
                        // 指定した地点の近辺にあるバス停の識別子を格納
                        busStopPole: entry["owl:sameAs"],
                        // 指定した地点の近辺にあるバス停にやってくるバスの系統を全て格納
                        busRoutePattern: entry["odpt:busroutePattern"]
                    }
                );
            });
        })
        .catch((error) => {
            console.log(error);
        });

    // ①確認
    //console.log(busStopInfo);
    //console.log();


    // ②到達可能なバス停を全て格納
    let reachableBusStopPoles = [];

    // ②到達可能なバス停を探索
    for (let i = 0; i < busStopInfo.length; i++) {
        for (let j = 0; j < busStopInfo[i]["busRoutePattern"].length; j++) {

            // 指定した系統のバス時刻表を取得するためのURL
            const getBusTimetableURL = {
                method: 'get',
                maxBodyLength: Infinity,
                url: baseUrl + 'odpt:BusTimetable?odpt:busroutePattern=' + busStopInfo[i]["busRoutePattern"][j] + '&odpt:calendar=' + calendar + '&acl:consumerKey=' + apiKey,
                headers: {}
            };

            // バス停の識別子
            const busStopPole = busStopInfo[i]["busStopPole"];

            // リクエスト
            await axios.request(getBusTimetableURL)
                .then((response) => {
                    //console.log(response.data);

                    // forEachではbreakできないため、for-ofを利用する（一気に外まで抜けるためにラベルを設定）
                    ExtractBusStopPoles: for (const timetable of response.data) {

                        // 現在処理中の配列
                        const array = timetable['odpt:busTimetableObject'];

                        for (const [index, busObj] of array.entries()) {
                            // "busTimetableObject"の要素は"arrivalTime"か"departureTime"の
                            // どちらかのプロパティしか持っていないためここで判定を行う。
                            const busArrivalTimeStartPoint_String = 'odpt:arrivalTime' in busObj ? busObj['odpt:arrivalTime'] : busObj['odpt:departureTime'];

                            // 各バスの到着時刻（始点）を取得
                            const [hours, minutes] = busArrivalTimeStartPoint_String.split(':').map(Number);
                            const busArrivalTimeStartPoint = hours * 60 * 60 + minutes * 60;

                            // 時刻表の中から①で取得したバス停が含まれていること、かつ、
                            // バスの到着時刻（始点）が、設定した出発時刻よりも後にあること（バスの到着時刻の方が大きいこと）
                            if (busObj['odpt:busstopPole'] == busStopPole && departureTime < busArrivalTimeStartPoint) {
                                //console.log(busObj);

                                // 始点を見つかったので、その後の条件を満たす範囲を抽出
                                const subsequentObjects = array.slice(index).filter(subsequentObj => {

                                    // "busTimetableObject"の要素は"arrivalTime"か"departureTime"の
                                    // どちらかのプロパティしか持っていないためここで判定を行う。
                                    const busArrivalTimeEndPoint_String = 'odpt:arrivalTime' in subsequentObj ? subsequentObj['odpt:arrivalTime'] : subsequentObj['odpt:departureTime'];

                                    // 各バスの到着時刻（終点）を取得
                                    const [subHours, subMinutes] = busArrivalTimeEndPoint_String.split(':').map(Number);
                                    const busArrivalTimeEndPoint = subHours * 60 * 60 + subMinutes * 60;

                                    // 出発時刻から許容時刻が経過するまでのバス停を全て抽出
                                    return busArrivalTimeEndPoint <= departureTime + requiredTime;
                                });

                                // 空配列が入ってくるので除外する
                                if (subsequentObjects.length) {
                                    reachableBusStopPoles.push(subsequentObjects);
                                }

                                // 一気に外まで抜ける
                                break ExtractBusStopPoles;
                            }
                        }
                    }
                })
                .catch((error) => {
                    console.log(error);
                });
        }
    }

    // ②確認
    //console.log(reachableBusStopPoles);
    //console.log();


    // ③到達可能なバス停情報を全て格納
    let reachableBusStopInfo = [];

    // ③到達可能なバス停情報を探索
    for (let i = 0; i < reachableBusStopPoles.length; i++) {
        for (let j = 0; j < reachableBusStopPoles[i].length; j++) {

            const busObj = reachableBusStopPoles[i][j];

            // "busTimetableObject"の要素は"arrivalTime"か"departureTime"の
            // どちらかのプロパティしか持っていないためここで判定を行う。
            const busArrivalTime_String = 'odpt:arrivalTime' in busObj ? busObj['odpt:arrivalTime'] : busObj['odpt:departureTime'];

            // 各バスの到着時刻を取得
            const [hours, minutes] = busArrivalTime_String.split(':').map(Number);
            const busArrivalTime = hours * 60 * 60 + minutes * 60;

            // 指定したバス停情報を取得するためのURL
            const getReachableBusstopInfoURL = {
                method: 'get',
                maxBodyLength: Infinity,
                url: baseUrl + 'odpt:BusstopPole?owl:sameAs=' + busObj['odpt:busstopPole'] + '&acl:consumerKey=' + apiKey,
                headers: {}
            };

            // リクエスト
            await axios.request(getReachableBusstopInfoURL)
                .then((response) => {
                    //console.log(response.data);
                    response.data.forEach(entry => {
                        //console.log(entry);
                        reachableBusStopInfo.push(
                            {
                                // バス停名
                                busStopName: entry["dc:title"],
                                // 緯度
                                lat: entry["geo:lat"],
                                // 経度
                                lon: entry["geo:long"],
                                // 到着時刻
                                arrivalTime: busArrivalTime
                            }
                        );
                    });
                })
                .catch((error) => {
                    console.log(error);
                });

        }
    }

    // ④ソート
    reachableBusStopInfo.sort((a, b) => a.arrivalTime - b.arrivalTime);

    // ⑤重複削除
    reachableBusStopInfo = reachableBusStopInfo.filter(
        (element, index, self) => self.findIndex((e) => e.busStopName === element.busStopName) === index
    );

    // ⑤確認
    //console.log(reachableBusStopInfo);

    return reachableBusStopInfo;
}
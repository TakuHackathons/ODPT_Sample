import axios from 'axios';
import dotenv from 'dotenv';


// lat: 緯度
// lon: 経度
// radius: 緯度、経度から半径何[m]を対象に探索するか（0〜4000[m]）
// isHoliday: 休日ならTrue
// departureTime: 駅からの出発時刻（0:00からの経過時間（秒）で設定）
// reqiredTime: 出発（駅）から到着（駅）までの期待する許容時間（秒）を設定

async function reachableTrainAreaAnalysis(lat, lon, radius, isHoliday, departureTime, requiredTime) {

    const baseUrl = "https://api-challenge2024.odpt.org/api/v4/";

    const apiKey = dotenv.config().parsed.API_KEY;

    // 平日か土日かを指定
    const calendar = isHoliday ? 'odpt.Calendar:Holiday' : 'odpt.Calendar:Weekday';


    // ①指定した地点の近辺にある駅情報を格納
    let stationInfo = [];

    // ①指定した地点の近辺にある駅を取得するためのURL
    const getNearStationURL = {
        method: 'get',
        maxBodyLength: Infinity,
        url: baseUrl + 'places/odpt:Station?lon=' + lon + '&lat=' + lat + '&radius=' + radius + '&acl:consumerKey=' + apiKey,
        headers: {}
    };

    // ①リクエスト
    await axios.request(getNearStationURL)
        .then((response) => {
            //console.log(response.data);
            response.data.forEach(entry => {
                //console.log(entry);
                stationInfo.push(
                    {
                        // 指定した地点の近辺にある駅の識別子を格納
                        station: entry["owl:sameAs"],
                        // 路線の識別子を全て格納
                        railway: entry["odpt:railway"]
                    }
                );
            });
        })
        .catch((error) => {
            console.log(error);
        });

    // ①確認
    //console.log(stationInfo);
    //console.log();


    // ②到達可能な駅を全て格納
    let reachableStations = [];

    // ②到達可能な駅を探索
    for (let i = 0; i < stationInfo.length; i++) {

        // 指定した系統の列車時刻表を取得するためのURL
        const getTrainTimetableURL = {
            method: 'get',
            maxBodyLength: Infinity,
            url: baseUrl + 'odpt:TrainTimetable?odpt:railway=' + stationInfo[i]["railway"] + '&odpt:calendar=' + calendar + '&acl:consumerKey=' + apiKey,
            headers: {}
        };

        // 駅の識別子
        const station = stationInfo[i]["station"];

        // リクエスト
        await axios.request(getTrainTimetableURL)
            .then((response) => {
                //console.log(response.data);

                // forEachではbreakできないため、for-ofを利用する（一気に外まで抜けるためにラベルを設定）
                ExtractTrainStations: for (const timetable of response.data) {

                    // 現在処理中の配列
                    const array = timetable['odpt:trainTimetableObject'];

                    for (const [index, trainObj] of array.entries()) {
                        // "trainTimetableObject"の要素に
                        // "arrivalTime"が設定されていない、かつ、
                        // "departureTime"が設定されていない場合、
                        // 処理をパスする（Continue）
                        if (!('odpt:arrivalTime' in trainObj) && !('odpt:departureTime' in trainObj)) {
                            continue;
                        }

                        // "trainTimetableObject"の要素は"arrivalTime"か"departureTime"の
                        // どちらかのプロパティしか持っていないためここで判定を行う。
                        const trainArrivalTimeStartPoint_String = 'odpt:arrivalTime' in trainObj ? trainObj['odpt:arrivalTime'] : trainObj['odpt:departureTime'];

                        // 各列車の到着時刻（始点）を取得
                        const [hours, minutes] = trainArrivalTimeStartPoint_String.split(':').map(Number);
                        const trainArrivalTimeStartPoint = hours * 60 * 60 + minutes * 60;

                        // "trainTimetableObject"の要素は"arrivalStation"か"departureStation"の
                        // どちらかのプロパティしか持っていないためここで判定を行う。
                        const trainArrivalStation = 'odpt:arrivalStation' in trainObj ? trainObj['odpt:arrivalStation'] : trainObj['odpt:departureStation'];

                        // 時刻表の中から①で取得した駅が含まれていること、かつ、
                        // 列車の到着時刻（始点）が、設定した出発時刻よりも後にあること（列車の到着時刻の方が大きいこと）
                        if (trainArrivalStation == station && departureTime < trainArrivalTimeStartPoint) {
                            //console.log(trainObj);

                            // 始点を見つかったので、その後の条件を満たす範囲を抽出
                            const subsequentObjects = array.slice(index).filter(subsequentObj => {

                                // "trainTimetableObject"の要素は"arrivalTime"か"departureTime"の
                                // どちらかのプロパティしか持っていないためここで判定を行う。
                                const trainArrivalTimeEndPoint_String = 'odpt:arrivalTime' in subsequentObj ? subsequentObj['odpt:arrivalTime'] : subsequentObj['odpt:departureTime'];

                                // 各駅の到着時刻（終点）を取得
                                const [subHours, subMinutes] = trainArrivalTimeEndPoint_String.split(':').map(Number);
                                const trainArrivalTimeEndPoint = subHours * 60 * 60 + subMinutes * 60;

                                // 出発時刻から許容時刻が経過するまでの駅を全て抽出
                                return trainArrivalTimeEndPoint <= departureTime + requiredTime;
                            });

                            // 空配列が入ってくるので除外する
                            if (subsequentObjects.length) {
                                reachableStations.push(subsequentObjects);
                            }

                            // 一気に外まで抜ける
                            break ExtractTrainStations;
                        }
                    }
                }
            })
            .catch((error) => {
                console.log(error);
            });

    }

    // ②確認
    //console.log(reachableStations);
    //console.log();


    // ③到達可能な駅情報を全て格納
    let reachableStationInfo = [];

    // ③到達可能な駅情報を探索
    for (let i = 0; i < reachableStations.length; i++) {
        for (let j = 0; j < reachableStations[i].length; j++) {

            const trainObj = reachableStations[i][j];

            // "trainTimetableObject"の要素は"arrivalTime"か"departureTime"の
            // どちらかのプロパティしか持っていないためここで判定を行う。
            const trainArrivalTime_String = 'odpt:arrivalTime' in trainObj ? trainObj['odpt:arrivalTime'] : trainObj['odpt:departureTime'];

            // 各列車の到着時刻を取得
            const [hours, minutes] = trainArrivalTime_String.split(':').map(Number);
            const trainArrivalTime = hours * 60 * 60 + minutes * 60;

            // "trainTimetableObject"の要素は"arrivalStation"か"departureStation"の
            // どちらかのプロパティしか持っていないためここで判定を行う。
            const trainArrivalStation = 'odpt:arrivalStation' in trainObj ? trainObj['odpt:arrivalStation'] : trainObj['odpt:departureStation'];

            // 指定した駅情報を取得するためのURL
            const getreachableStationInfoURL = {
                method: 'get',
                maxBodyLength: Infinity,
                url: baseUrl + 'odpt:Station?owl:sameAs=' + trainArrivalStation + '&acl:consumerKey=' + apiKey,
                headers: {}
            };

            // リクエスト
            await axios.request(getreachableStationInfoURL)
                .then((response) => {
                    //console.log(response.data);
                    response.data.forEach(entry => {
                        //console.log(entry);
                        reachableStationInfo.push(
                            {
                                // 駅名
                                stationName: entry["dc:title"],
                                // 緯度
                                lat: entry["geo:lat"],
                                // 経度
                                lon: entry["geo:long"],
                                // 到着時刻
                                arrivalTime: trainArrivalTime
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
    reachableStationInfo.sort((a, b) => a.arrivalTime - b.arrivalTime);

    // ⑤重複削除
    reachableStationInfo = reachableStationInfo.filter(
        (element, index, self) => self.findIndex((e) => e.stationName === element.stationName) === index
    );

    // ⑤確認
    //console.log(reachableStationInfo);

    return reachableStationInfo;
}

export { reachableTrainAreaAnalysis }
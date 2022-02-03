import mqtt from "async-mqtt";
// @ts-ignore
import SunCalc from "suncalc";
import { setIntervalAsync } from "set-interval-async/dynamic";

const {
  devices,
  maxTemp,
  minTemp,
  transitionTime,
  intervalTime,
  latLong: { lat, long },
  buffer,
} = {
  devices: [
    {
      id: "E8DB84D46422",
    },
  ],
  maxTemp: 5500,
  minTemp: 3500,
  transitionTime: 2 * 1000,
  intervalTime: 5 * 1000,
  latLong: {
    lat: -33.92,
    long: 18.42,
  },
  buffer: 60,
};

const getTopic = (deviceId: string) => {
  return `shellies/ShellyBulbDuo-${deviceId}/light/0/set`;
};

const getColourTemp = ({ date }: { date: Date }) => {
  const { sunrise, sunset }: { [key: string]: Date } = SunCalc.getTimes(
    date,
    lat,
    long
  );

  const nowUnix = date.getTime() / 1000;
  const band = buffer * 60;

  const sunriseUnix = sunrise.getTime() / 1000;
  const sunriseDiff = nowUnix - sunriseUnix;
  const isInSunriseBand = Math.abs(sunriseDiff) < band;
  const sunriseFraction = (nowUnix - (sunriseUnix - band)) / (band * 2);
  const sunriseColourTemp = Math.round(
    (maxTemp - minTemp) * sunriseFraction + minTemp
  );

  const sunsetUnix = sunset.getTime() / 1000;
  const sunsetDiff = nowUnix - sunsetUnix;
  const isInSunsetBand = Math.abs(sunsetDiff) < band;
  const sunsetFraction = 1 - (nowUnix - (sunsetUnix - band)) / (band * 2);
  const sunsetColourTemp = Math.round(
    (maxTemp - minTemp) * sunsetFraction + minTemp
  );

  const isDaytime = nowUnix > sunriseUnix && nowUnix < sunsetUnix;

  const colourTemp = isInSunriseBand
    ? sunriseColourTemp
    : isInSunsetBand
    ? sunsetColourTemp
    : isDaytime
    ? maxTemp
    : minTemp;

  return { colourTemp };
};

const client = mqtt.connect("mqtt://localhost:1883");

const main = async () => {
  const date = new Date();
  console.log("Checking colour temps...");
  const { colourTemp } = getColourTemp({ date });

  await Promise.all(
    devices.map(async (device) => {
      const payload = { temp: colourTemp, transition: transitionTime };
      console.log(
        `Adjusting device '${device.id}' colour temp to: ${colourTemp}K`
      );
      await client.publish(getTopic(device.id), JSON.stringify(payload), {
        retain: true,
      });
    })
  );
};

console.log("Starting...");
main();
setIntervalAsync(main, intervalTime);

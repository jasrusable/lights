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
  devices: [{ id: "D46422" }, { id: "D4AD89" }],
  maxTemp: 6500,
  minTemp: 3500,
  transitionTime: 4 * 1000,
  intervalTime: 10 * 1000,
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

const cache: { [key: string]: string | undefined } = {};

const main = async () => {
  const date = new Date();
  console.log("Checking colour temps...");
  const { colourTemp } = getColourTemp({ date });

  await Promise.all(
    devices.map(async (device) => {
      const payload = { temp: colourTemp, transition: transitionTime };
      const payloadHash = JSON.stringify(payload);
      const cachedPayloadHash = cache[device.id];
      const arePayloadHashesDifferent = payloadHash !== cachedPayloadHash;

      if (!arePayloadHashesDifferent) return;

      console.log(
        `Setting device '${device.id}' to: ${JSON.stringify(payload)}`
      );
      await client.publish(getTopic(device.id), JSON.stringify(payload), {
        retain: true,
      });

      cache[device.id] = payloadHash;
    })
  );
};

console.log("Starting...");
main();
setIntervalAsync(main, intervalTime);

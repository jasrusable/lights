import mqtt from "async-mqtt";
// @ts-ignore
import SunCalc from "suncalc";
import { setIntervalAsync } from "set-interval-async/dynamic";

// Lights to control
const devices = [
  { id: "D46422" },
  { id: "D4AD89" },
  { id: "E8DB84D506B3" },
  { id: "E8DB84D24FF7" },
  { id: "8CAAB55F93B5" },
  { id: "E8DB84D515BA" },
  { id: "E8DB84D24FD9" },
  { id: "E8DB84D46622" },
];
// Lat long
const latLong = {
  lat: -33.92,
  long: 18.42,
};
const maxTemp = 5800;
const minTemp = 3000;
// Transition time for applying light settings
const transitionTimeMilliseconds = 1000;
const updateFrequencySeconds = 15;
// How long to transition over in minutes.
const bufferMinutes = 30;

const getTopic = (deviceId: string) => {
  return `shellies/ShellyBulbDuo-${deviceId}/light/0/set`;
};

const getColourTemp = ({ date }: { date: Date }) => {
  const { sunrise, sunset }: { [key: string]: Date } = SunCalc.getTimes(
    date,
    latLong.lat,
    latLong.long
  );
  const nowUnix = date.getTime() / 1000;
  const bufferSeconds = bufferMinutes * 60;
  const halfBufferSeconds = bufferSeconds / 2;

  const sunriseUnix = sunrise.getTime() / 1000;
  const sunriseDiff = nowUnix - sunriseUnix;
  const isInSunriseBand = Math.abs(sunriseDiff) < halfBufferSeconds;
  const sunriseFraction =
    (nowUnix - (sunriseUnix - halfBufferSeconds)) / bufferSeconds;
  const sunriseColourTemp = Math.round(
    (maxTemp - minTemp) * sunriseFraction + minTemp
  );

  const sunsetUnix = sunset.getTime() / 1000;
  const sunsetDiff = nowUnix - sunsetUnix;
  const isInSunsetBand = Math.abs(sunsetDiff) < halfBufferSeconds;
  const sunsetFraction =
    1 - (nowUnix - (sunsetUnix - halfBufferSeconds)) / bufferSeconds;
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
  const { colourTemp } = getColourTemp({ date });

  await Promise.all(
    devices.map(async (device) => {
      const payload = {
        temp: colourTemp,
        transition: transitionTimeMilliseconds,
      };
      const payloadHash = JSON.stringify(payload);
      const cachedPayloadHash = cache[device.id];
      const arePayloadHashesDifferent = payloadHash !== cachedPayloadHash;

      if (!arePayloadHashesDifferent) return;

      await client.publish(getTopic(device.id), JSON.stringify(payload), {
        retain: true,
      });

      cache[device.id] = payloadHash;
    })
  );
};

console.log("Starting...");
main();
setIntervalAsync(main, updateFrequencySeconds * 1000);

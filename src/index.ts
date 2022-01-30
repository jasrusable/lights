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
  minTemp: 3000,
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

const getColourTempForDate = ({ date }: { date: Date }) => {
  const { sunrise, sunset }: { [key: string]: Date } = SunCalc.getTimes(
    date,
    lat,
    long
  );

  const nowUnix = date.getTime() / 1000;
  const band = buffer * 60;

  const sunriseUnix = sunrise.getTime() / 1000;
  const sunriseDiff = nowUnix - sunriseUnix;
  if (Math.abs(sunriseDiff) < band) {
    const fraction = (nowUnix - (sunriseUnix - band)) / (band * 2);
    return Math.round((maxTemp - minTemp) * fraction + minTemp);
  }

  const sunsetUnix = sunset.getTime() / 1000;
  const sunsetDiff = nowUnix - sunsetUnix;
  if (Math.abs(sunsetDiff) < band) {
    const fraction = 1 - (nowUnix - (sunsetUnix - band)) / (band * 2);
    return Math.round((maxTemp - minTemp) * fraction + minTemp);
  }

  const isDaytime = nowUnix > sunriseUnix && nowUnix < sunsetUnix;
  return Math.round(isDaytime ? maxTemp : minTemp);
};

const client = mqtt.connect("mqtt://localhost:1883");
const main = async () => {
  const date = new Date();
  console.log("Checking colour temps...");

  const colourTemp = getColourTempForDate({ date });

  await Promise.all(
    devices.map(async (device) => {
      const payload = { temp: colourTemp, transition: transitionTime };
      console.log(
        `Adjusting device '${device.id}' colour temp to: ${colourTemp}K`
      );
      await client.publish(getTopic(device.id), JSON.stringify(payload));
    })
  );
};

console.log("Starting...");
main();
setIntervalAsync(main, intervalTime);

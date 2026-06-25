import { useEffect, useState } from "react";

const PHONE_MAX_WIDTH = 639;

/** True below `sm` — phone-sized viewport for game layout and grid presets. */
export function usePhoneGameLayout() {
  const [isPhone, setIsPhone] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= PHONE_MAX_WIDTH,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH}px)`);
    const update = () => setIsPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isPhone;
}

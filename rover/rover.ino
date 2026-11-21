/*
 * Bullhorn rover — OSOYOO FlexiRover + OSOYOO Model X driver + Arduino UNO R3
 *
 * Two ways to start the route:
 *   A) TETHERED (dispatch from the app): Uno stays plugged into the laptop by USB.
 *      server.py talks to it over serial. Clicking "Dispatch rover" on the
 *      dashboard sends 'G' and the rover drives. Use a long USB-B cable.
 *   B) UNTETHERED (backup): unplug USB, press the Uno's reset button. After
 *      3.5 s it drives the route once.
 * On every boot the Uno listens 3.5 s for a 'T' from the server. If it hears one
 * it waits for 'G' (mode A); if not, it runs the route (mode B).
 *
 * Serial protocol (9600 baud), laptop -> Uno: 'T' = tethered hello, 'G' = go, 'S' = stop
 *                              Uno -> laptop: BOOT, READY, GO, DONE
 *
 * How to use it:
 *   1. Plug the Uno into the laptop (USB-B), Tools > Board > "Arduino Uno",
 *      Tools > Port > the new port, then Upload (right-arrow button).
 *   2. Unplug USB. Put the rover on its taped start mark.
 *   3. Battery box switch ON. Press the Uno's reset button. Step back.
 *
 * Pins below match the OSOYOO Lesson 1 wiring already in this repo
 * (v2smartcar-lesson1). If your jumpers go somewhere else, change ONLY these 6 lines.
 * ENA and ENB must be PWM pins (3, 5, 6, 9, 10 or 11).
 */

// ---------------- PINS (Uno pin numbers) ----------------
const int ENA = 9;    // Model X ENA  -> right side speed (PWM)
const int IN1 = 12;   // Model X IN1  -> right side direction
const int IN2 = 11;   // Model X IN2  -> right side direction
const int IN3 = 7;    // Model X IN3  -> left side direction
const int IN4 = 8;    // Model X IN4  -> left side direction
const int ENB = 6;    // Model X ENB  -> left side speed (PWM)

// ---------------- TUNING ----------------
// Drift fix: if the rover curves RIGHT when it should go straight, the left side is
// stronger -> lower LEFT_TRIM (e.g. 0.92). Curves LEFT -> lower RIGHT_TRIM.
const float LEFT_TRIM  = 1.00;
const float RIGHT_TRIM = 1.00;

// Backward side fix: if one side spins BACKWARD when you call drive(200, 200),
// set that side's flag to true (it swaps that side's direction in software,
// no rewiring needed).
const bool LEFT_REVERSED  = false;
const bool RIGHT_REVERSED = false;

// Speed used by the route. 0..255. TT motors usually need ~120+ to start moving.
const int CRUISE = 180;
const int TURN   = 170;

// ---------------- MOTOR HELPERS ----------------

// Set one side. speed: -255 (full reverse) .. 255 (full forward). 0 = stop.
void setSide(int pwmPin, int inA, int inB, int speed, bool reversed) {
  if (reversed) speed = -speed;
  speed = constrain(speed, -255, 255);
  if (speed > 0) {
    digitalWrite(inA, HIGH);
    digitalWrite(inB, LOW);
  } else if (speed < 0) {
    digitalWrite(inA, LOW);
    digitalWrite(inB, HIGH);
  } else {
    digitalWrite(inA, LOW);
    digitalWrite(inB, LOW);
  }
  analogWrite(pwmPin, abs(speed));
}

// drive(left, right): each -255..255. drive(200, 200) = forward, drive(-200, 200) = spin left.
void drive(int left, int right) {
  setSide(ENB, IN3, IN4, (int)(left * LEFT_TRIM), LEFT_REVERSED);
  setSide(ENA, IN1, IN2, (int)(right * RIGHT_TRIM), RIGHT_REVERSED);
}

void stopMotors() {
  drive(0, 0);
}

// Run a motion for `ms` milliseconds, then brake briefly so the next move starts clean.
void move(int left, int right, unsigned long ms) {
  drive(left, right);
  delay(ms);
  stopMotors();
  delay(250);
}

// ---------------- ROUTE ----------------
void runRoute() {
  // ---- The route: barn (start mark) -> straight -> right turn -> cow box ----
  // Distance tuning: the number in ms is how long it drives. More ms = farther.
  // At CRUISE=180 on a smooth floor, 1000 ms is roughly 40-60 cm. Measure yours once
  // and scale (e.g. need 1.5x farther -> multiply the ms by 1.5).
  // Turn tuning: increase/decrease the turn ms until it turns ~90 degrees.

  move(CRUISE, CRUISE, 2500);        // 1. forward out of the barn
  move(TURN, -TURN, 450);            // 2. spin right ~90 degrees (left forward, right back)
  move(CRUISE, CRUISE, 1800);        // 3. forward to the cow box
  // Need a left turn instead? use move(-TURN, TURN, 450);

  stopMotors();                      // 4. stop in front of the cow: phone camera faces the box
}

bool tethered = false;
const unsigned long LISTEN_MS = 3500;  // also gives you time to step back in untethered mode

void setup() {
  pinMode(ENA, OUTPUT);
  pinMode(ENB, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
  stopMotors();

  Serial.begin(9600);
  Serial.println("BOOT");

  // Built-in LED on while listening, so you can see it's about to go.
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH);
  unsigned long start = millis();
  while (millis() - start < LISTEN_MS) {
    if (Serial.available() && Serial.read() == 'T') {
      tethered = true;
      break;
    }
  }
  digitalWrite(LED_BUILTIN, LOW);

  if (tethered) {
    Serial.println("READY");         // wait for 'G' from the dashboard (see loop)
  } else {
    runRoute();                      // untethered: reset button = one run
  }
}

void loop() {
  if (!Serial.available()) return;
  char c = Serial.read();
  if (c == 'G') {
    Serial.println("GO");
    runRoute();
    Serial.println("DONE");
  } else if (c == 'T') {
    tethered = true;
    Serial.println("READY");
  } else if (c == 'S') {
    stopMotors();
    Serial.println("READY");
  }
}

const fs = require('fs')
const privateKey = fs.readFileSync('server.key')
const certificate = fs.readFileSync('server.crt')
// const privateKey = fs.readFileSync('key.pem')
// const certificate = fs.readFileSync('cert.pem')
const credentials = { key: privateKey, cert: certificate }
const express = require('express')
const app = express()
const path = require('path')
const https = require('https')
const httpsServer = https.createServer(credentials, app)
const io = require('socket.io')(httpsServer, {
    cors: {
        origin: '*',
    }
})
const port = process.env.PORT || 3000
const robot = require('robot-js')
const keyboard = new robot.Keyboard()
console.log(keyboard)

httpsServer.listen(port, () => {
    console.log('Server listening at port %d', port);
})

// Routing
app.use(express.static(path.join(__dirname, 'public')));

// Chatroom

let lastDirectionTap = Date.now()
let gamma = 0
let maxGamma = 0
let beta = 0
const GAMMA_DIRECTION_THRESHOLD = 3
const BETA_BRAKE_THRESHOLD = 20
const BETA_JUMP_THRESHOLD = 6
const AIR_DRIFT_START_THRESHOLD = 15
const AIR_DRIFT_END_THRESHOLD = 3
const BETA_BOOST_THRESHOLD = -3
let brakeState = false
let jumpState = false
let airDrift = false

let firstPacket = true
io.on('connection', (socket) => {
    console.log('phone connected')
    socket.on('gyro', (gyroData) => {
        // beta is for rear [90, -90] to front
        // gamma is for side to side, goes from -90 to 90
        if (firstPacket) {
            console.log(gyroData)
            firstPacket = false
        }
        gamma = gyroData.gamma
        if (gamma > maxGamma) {
            maxGamma = gamma
            // console.log('max gamma now ' + maxGamma)
        }
        if (!airDrift) {
            if (Math.abs(gamma) > AIR_DRIFT_START_THRESHOLD) {
                keyboard.press(directionForGamma() === 'left' ? robot.KEY_LEFT : robot.KEY_RIGHT)
                keyboard.press(robot.KEY_E)
                airDrift = true
                console.log('airdrift start')
            }
        } else if (airDrift) {
            if (Math.abs(gamma) < AIR_DRIFT_END_THRESHOLD) {
                keyboard.release(directionForGamma() === 'left' ? robot.KEY_LEFT : robot.KEY_RIGHT)
                keyboard.release(robot.KEY_E)
                airDrift = false
                console.log('airdrift end')
            }
        }
        beta = gyroData.beta
        setBrake(beta > BETA_BRAKE_THRESHOLD)
        setJumpState(beta)
        setBoostState(beta)
    })
})

const MAX_GAMMA = 40
function intervalForGamma () {
    if (Math.abs(gamma) < GAMMA_DIRECTION_THRESHOLD) return Infinity
    return Math.abs(500 / gamma)
}

function directionForGamma () {
    return gamma < 0 ? 'left' : 'right'
    // return gamma < 0 ? robot.KEY_LEFT : robot.KEY_RIGHT
}

setInterval(directionTapping, 16)
function directionTapping () {
    // console.log(intervalForGamma())
    const now = Date.now()
    const timeSinceLastTap = now - lastDirectionTap
    if (intervalForGamma() < timeSinceLastTap) {
        lastDirectionTap = now
        // robot.keyTap(directionForGamma());
        keyboard.click(directionForGamma() === 'left' ? robot.KEY_LEFT : robot.KEY_RIGHT)
        // console.log('tapped ' + directionForGamma())
    }
}

let isRaceStart = true
function setBrake (newState) {
    if (newState != brakeState) {
        brakeState = newState
        // robot.keyToggle('q', brakeState ? 'down' : 'up')
        if (brakeState) {
            keyboard.press(robot.KEY_Q)
            keyboard.release(robot.KEY_UP)
            if (isRaceStart) {
                keyboard.press(robot.KEY_DOWN)
            }
            console.log('started braking')
        } else {
            keyboard.release(robot.KEY_Q)
            keyboard.press(robot.KEY_UP)
            if (isRaceStart) {
                keyboard.release(robot.KEY_DOWN)
                isRaceStart = false
            }
            console.log('stopped braking')
        }
    }
}

function setJumpState (beta) {
    if (jumpState) {
        if (beta < BETA_JUMP_THRESHOLD - 2) {
            jumpState = false
            console.log('ended jump')
        }
    } else {
        if (beta > BETA_JUMP_THRESHOLD) {
            if (!airDrift) {
                keyboard.click(robot.KEY_S)
            }
            console.log('jumped')
            jumpState = true
        }
    }
}


let boostState = false
function setBoostState (beta) {
    if (boostState) {
        if (beta > BETA_BOOST_THRESHOLD + 1) {
            boostState = false
            console.log('ended boost')
        }
    } else {
        if (beta < BETA_BOOST_THRESHOLD) {
            if (!airDrift) {
                keyboard.click(robot.KEY_D)
                console.log('boosted')
            }
            boostState = true
        }
    }
}


/*
test
setInterval(function () {
    keyboard.click(robot.KEY_Q)
}, 2000)
*/

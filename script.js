document.addEventListener("DOMContentLoaded", function() {
    const audioFileInput = document.getElementById("audioFile");
    const messageInput = document.getElementById("message");
    const hideButton = document.getElementById("hideButton");
    const extractButton = document.getElementById("extractButton");
    const resetButton = document.getElementById("resetButton");
    const downloadLink = document.getElementById("downloadLink");

    const peanoCurve = (size) => {
        let curve = [];
        for (let i = 0; i < size; i++) {
            curve.push(i);
        }
        return curve;
    };

    hideButton.addEventListener("click", function() {
        const audioFile = audioFileInput.files[0];
        const message = messageInput.value;
        if (!audioFile) {
            alert("Please select an audio file first.");
            return;
        }
        if (!message) {
            alert("Please enter a message to hide.");
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            const audioData = event.target.result;
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();

            audioContext.decodeAudioData(audioData, function(buffer) {
                const messageBytes = new TextEncoder().encode(message);
                const outputBuffer = buffer.getChannelData(0);

                const curveOrder = Math.min(messageBytes.length, outputBuffer.length);
                const curve = peanoCurve(curveOrder);

                for (let i = 0; i < messageBytes.length; i++) {
                    const index = curve[i % curve.length];
                    outputBuffer[index] = messageBytes[i] / 256.0;
                }

                const newBuffer = audioContext.createBuffer(1, outputBuffer.length, buffer.sampleRate);
                newBuffer.copyToChannel(outputBuffer, 0);

                const audioBlob = bufferToWav(newBuffer);
                const audioUrl = URL.createObjectURL(audioBlob);

                const link = document.createElement("a");
                link.href = audioUrl;
                link.download = "stegano_audio.wav";
                link.textContent = "Download Stegano Audio";
                downloadLink.innerHTML = "";
                downloadLink.appendChild(link);
            }, function(error) {
                console.error("Decoding the audio buffer failed", error);
            });
        };
        reader.readAsArrayBuffer(audioFile);
    });

    extractButton.addEventListener("click", function() {
        const audioFile = audioFileInput.files[0];
        if (!audioFile) {
            alert("Please select an audio file first.");
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            const audioData = event.target.result;
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();

            audioContext.decodeAudioData(audioData, function(buffer) {
                const inputBuffer = buffer.getChannelData(0);

                const curveOrder = inputBuffer.length;
                const curve = peanoCurve(curveOrder);

                let messageBytes = [];
                for (let i = 0; i < inputBuffer.length; i++) {
                    const index = curve[i % curve.length];
                    const byte = Math.round(inputBuffer[index] * 256);
                    if (byte === 0) break;
                    messageBytes.push(byte);
                }

                const message = new TextDecoder().decode(new Uint8Array(messageBytes));
                alert("Extracted message: " + message);
            }, function(error) {
                console.error("Decoding the audio buffer failed", error);
            });
        };
        reader.readAsArrayBuffer(audioFile);
    });

    resetButton.addEventListener("click", function() {
        audioFileInput.value = "";
        messageInput.value = "";
        downloadLink.innerHTML = "";
    });

    function bufferToWav(buffer) {
        let numOfChan = buffer.numberOfChannels,
            length = buffer.length * numOfChan * 2 + 44,
            bufferArray = new ArrayBuffer(length),
            view = new DataView(bufferArray),
            channels = [], i, sample,
            offset = 0,
            pos = 0;

        setUint32(0x46464952); // "RIFF"
        setUint32(length - 8); // file length - 8
        setUint32(0x45564157); // "WAVE"
        setUint32(0x20746d66); // "fmt " chunk
        setUint32(16);         // length = 16
        setUint16(1);          // PCM (uncompressed)
        setUint16(numOfChan);
        setUint32(buffer.sampleRate);
        setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
        setUint16(numOfChan * 2);                     // block-align
        setUint16(16);        // 16-bit (hardcoded in this demo)
        setUint32(0x61746164); // "data" -chunk
        setUint32(length - pos - 4); // chunk length

        for (i = 0; i < buffer.numberOfChannels; i++)
            channels.push(buffer.getChannelData(i));

        while (pos < length) {
            for (i = 0; i < numOfChan; i++) {
                sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
                sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0; // to 16-bit signed int
                view.setInt16(pos, sample, true); // write 16-bit sample
                pos += 2;
            }
            offset++
        }

        return new Blob([bufferArray], { type: 'audio/wav' });

        function setUint16(data) {
            view.setUint16(pos, data, true);
            pos += 2;
        }

        function setUint32(data) {
            view.setUint32(pos, data, true);
            pos += 4;
        }
    }
});

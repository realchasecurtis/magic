export function installRecording({ dialog, toast }) {
  const $ = (s) => document.querySelector(s),
    button = $("#record-button");
  let active = null,
    pointer = { x: -100, y: -100 };
  window.addEventListener(
    "pointermove",
    (e) => (pointer = { x: e.clientX, y: e.clientY }),
  );
  button.onclick = () => {
    if (active) {
      active.stop();
      return;
    }
    if (!window.magicDesktop?.armRecording) {
      toast("Recording is available in the Magic desktop app.");
      return;
    }
    dialog(
      '<h2>Record Magic</h2><div class="record-settings"><label>Capture<select id="record-area"><option value="canvas">Canvas</option><option value="app">Entire Magic interface</option></select></label><label>Frame rate<select id="record-fps"><option>24</option><option selected>30</option><option>60</option></select></label><label class="record-toggle"><input id="record-system" type="checkbox" checked> Desktop audio</label><label class="record-toggle"><input id="record-mic" type="checkbox" checked> Microphone</label><label>Microphone device<select id="record-mic-device"><option value="">System default</option></select></label><label>Camera device<select id="record-camera-device"><option value="">System default</option></select></label><label class="record-toggle"><input id="record-camera" type="checkbox"> Include webcam</label><label>Webcam diameter <output id="camera-size-label">220 px</output><input id="record-camera-size" type="range" min="140" max="360" value="220"></label></div><button id="record-devices">Refresh devices / preview</button><p id="record-device-status">Enable webcam to preview it before recording.</p><video id="camera-preview" autoplay muted playsinline hidden></video><p>Only Magic is captured. Desktop audio includes sounds from other applications.</p><button id="record-start" class="primary">Start recording</button>',
    );
    const sizePreview = () => {
      const size = Number($("#record-camera-size").value);
      $("#camera-preview").style.width = size + "px";
      $("#camera-preview").style.height = size + "px";
      $("#record-camera-size").title = size + " px";
      $("#camera-size-label").textContent = size + " px";
    };
    $("#record-camera-size").oninput = sizePreview;
    sizePreview();
    let previewStream = null,
      previewGeneration = 0;
    const stopPreview = () => {
      previewGeneration++;
      previewStream?.getTracks().forEach((t) => t.stop());
      previewStream = null;
      if ($("#camera-preview")) $("#camera-preview").srcObject = null;
    };
    const refresh = async () => {
      stopPreview();
      const generation = previewGeneration;
      try {
        const camera = $("#record-camera").checked,
          microphone = $("#record-mic").checked;
        await window.magicDesktop.previewRecording({ camera, microphone });
        const stream =
          camera || microphone
            ? await navigator.mediaDevices.getUserMedia({
                audio: microphone
                  ? {
                      deviceId: $("#record-mic-device").value
                        ? { exact: $("#record-mic-device").value }
                        : undefined,
                    }
                  : false,
                video: camera
                  ? {
                      deviceId: $("#record-camera-device").value
                        ? { exact: $("#record-camera-device").value }
                        : undefined,
                    }
                  : false,
              })
            : null;
        if (generation !== previewGeneration || !$("#dialog").open) {
          stream?.getTracks().forEach((t) => t.stop());
          return;
        }
        previewStream = stream;
        const devices = await navigator.mediaDevices.enumerateDevices();
        for (const [id, kind] of [
          ["record-mic-device", "audioinput"],
          ["record-camera-device", "videoinput"],
        ]) {
          const select = $("#" + id),
            value = select.value;
          select.replaceChildren(
            new Option("System default", ""),
            ...devices
              .filter((d) => d.kind === kind)
              .map(
                (d, i) =>
                  new Option(d.label || "Device " + (i + 1), d.deviceId),
              ),
          );
          select.value = value;
        }
        $("#camera-preview").hidden = !camera;
        $("#camera-preview").srcObject = camera ? stream : null;
        if (camera) await $("#camera-preview").play();
        $("#record-device-status").textContent =
          "Devices ready. Preview audio is muted.";
      } catch (e) {
        $("#record-device-status").textContent = "Device access: " + e.message;
      }
    };
    $("#record-devices").onclick = refresh;
    for (const id of [
      "record-camera",
      "record-mic",
      "record-mic-device",
      "record-camera-device",
    ])
      $("#" + id).onchange = refresh;
    $("#dialog").addEventListener(
      "close",
      () => {
        stopPreview();
        window.magicDesktop.previewRecording(null);
      },
      { once: true },
    );
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      if (!$("#record-mic-device")) return;
      for (const [id, kind] of [
        ["record-mic-device", "audioinput"],
        ["record-camera-device", "videoinput"],
      ])
        devices
          .filter((d) => d.kind === kind)
          .forEach((d, i) =>
            $("#" + id).add(
              new Option(d.label || "Device " + (i + 1), d.deviceId),
            ),
          );
    });
    $("#record-start").onclick = async () => {
      const options = {
        micDevice: $("#record-mic-device").value,
        cameraDevice: $("#record-camera-device").value,
        area: $("#record-area").value,
        systemAudio: $("#record-system").checked,
        microphone: $("#record-mic").checked,
        camera: $("#record-camera").checked,
        size: Number($("#record-camera-size").value),
        fps: Number($("#record-fps").value),
      };
      stopPreview();
      $("#record-start").disabled = true;
      const streams = [],
        videos = [];
      let audioContext,
        timer,
        cam,
        recorder,
        queue = Promise.resolve(),
        armed = false;
      const cleanup = () => {
        clearInterval(timer);
        streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
        videos.forEach((v) => {
          v.srcObject = null;
          v.remove();
        });
        cam?.remove();
        audioContext?.close();
        active = null;
        button.classList.remove("recording");
        button.textContent = "●";
        button.title = "Start recording";
        $("#record-indicator")?.remove();
      };
      try {
        await window.magicDesktop.armRecording(options);
        armed = true;
        const display = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: options.fps, cursor: "never" },
          audio: options.systemAudio,
        });
        streams.push(display);
        const video = document.createElement("video");
        video.muted = true;
        video.srcObject = display;
        await video.play();
        videos.push(video);
        if (options.microphone || options.camera) {
          const input = await navigator.mediaDevices.getUserMedia({
            audio: options.microphone
              ? {
                  deviceId: options.micDevice
                    ? { exact: options.micDevice }
                    : undefined,
                }
              : false,
            video: options.camera
              ? {
                  width: 640,
                  height: 640,
                  deviceId: options.cameraDevice
                    ? { exact: options.cameraDevice }
                    : undefined,
                }
              : false,
          });
          streams.push(input);
          if (options.camera) {
            cam = document.createElement("video");
            cam.id = "record-webcam";
            cam.muted = true;
            cam.autoplay = true;
            cam.srcObject = input;
            cam.style.width = cam.style.height = options.size + "px";
            $("#viewport").append(cam);
            await cam.play();
          }
        }
        const canvas = document.createElement("canvas"),
          ctx = canvas.getContext("2d"),
          initial =
            options.area === "canvas"
              ? $("#viewport").getBoundingClientRect()
              : { width: innerWidth, height: innerHeight };
        canvas.width = Math.round(initial.width / 2) * 2;
        canvas.height = Math.round(initial.height / 2) * 2;
        const paint = () => {
          const r =
            options.area === "canvas"
              ? $("#viewport").getBoundingClientRect()
              : { x: 0, y: 0, width: innerWidth, height: innerHeight };
          const sx = video.videoWidth / innerWidth,
            sy = video.videoHeight / innerHeight;
          ctx.fillStyle = "#202326";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(
            video,
            r.x * sx,
            r.y * sy,
            r.width * sx,
            r.height * sy,
            0,
            0,
            canvas.width,
            canvas.height,
          );
          const px = ((pointer.x - r.x) * canvas.width) / r.width,
            py = ((pointer.y - r.y) * canvas.height) / r.height;
          if (px >= 0 && py >= 0 && px < canvas.width && py < canvas.height) {
            ctx.save();
            ctx.translate(px, py);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(4, 19);
            ctx.lineTo(9, 13);
            ctx.lineTo(16, 12);
            ctx.closePath();
            ctx.fillStyle = "#12cafd";
            ctx.fill();
            ctx.strokeStyle = "white";
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
          }
        };
        paint();
        timer = setInterval(paint, 1000 / options.fps);
        const output = canvas.captureStream(options.fps);
        streams.push(output);
        const audioTracks = streams.flatMap((s) => s.getAudioTracks());
        if (audioTracks.length) {
          audioContext = new AudioContext();
          const destination = audioContext.createMediaStreamDestination();
          for (const track of audioTracks)
            audioContext
              .createMediaStreamSource(new MediaStream([track]))
              .connect(destination);
          destination.stream
            .getAudioTracks()
            .forEach((t) => output.addTrack(t));
        }
        const mime = [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
        ].find((t) => MediaRecorder.isTypeSupported(t));
        recorder = new MediaRecorder(output, {
          mimeType: mime,
          videoBitsPerSecond: 6000000,
        });
        recorder.ondataavailable = (e) => {
          if (e.data.size)
            queue = queue.then(async () =>
              window.magicDesktop.recordChunk(
                new Uint8Array(await e.data.arrayBuffer()),
              ),
            );
        };
        recorder.onstop = async () => {
          cleanup();
          try {
            await queue;
            const result = await window.magicDesktop.finishRecording(false);
            toast(
              result?.saved
                ? "Recording saved."
                : result?.error || "Recording discarded.",
            );
          } catch (e) {
            toast("Recording save failed: " + e.message);
          }
        };
        recorder.onerror = (e) => {
          toast("Recording error: " + e.error?.message);
          if (recorder.state !== "inactive") recorder.stop();
        };
        active = {
          stop: () => {
            if (recorder.state !== "inactive") recorder.stop();
          },
        };
        display.getVideoTracks()[0].onended = () => active?.stop();
        recorder.start(1000);
        $("#dialog").close();
        button.classList.add("recording");
        button.textContent = "■";
        button.title = "Stop recording";
        const indicator = document.createElement("span");
        indicator.id = "record-indicator";
        indicator.textContent = "● RECORDING";
        $("#viewport").append(indicator);
      } catch (e) {
        cleanup();
        if (armed) await window.magicDesktop.finishRecording(true);
        toast("Recording could not start: " + e.message);
        $("#record-start")?.removeAttribute("disabled");
      }
    };
  };
}

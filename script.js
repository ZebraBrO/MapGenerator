class seededRandomGenerator {
    constructor(seed) {
        this.seed = seed;
    }
    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280; // Обновление seed
        return this.seed / 233280;
    }
}

const biomes = [
    { name: "plains", color: "#6f956f" },
    { name: "plains", color: "#6f956f" },
    { name: "plains", color: "#6f956f" },
    { name: "plains", color: "#6f956f" },
    { name: "plains", color: "#6f956f" },
    { name: "plains", color: "#6f956f" },
    { name: "forest", color: "#005c00" },
    { name: "forest", color: "#005c00" },
    { name: "forest", color: "#005c00" },
    { name: "desert", color: "#deb887" },
    { name: "desert", color: "#deb887" },
    { name: "mountains", color: "#a7bddb" },
    { name: "tundra", color: "#9fd6c9" }
];

let randomGenerator; // Объявляем глобально

function copyCanvas(sourceCanvas, targetCanvas) {
    const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const targetCtx = targetCanvas.getContext("2d", { willReadFrequently: true });

    targetCanvas.width = sourceCanvas.width;
    targetCanvas.height = sourceCanvas.height;
    targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height); // Очистка перед копированием
    targetCtx.drawImage(sourceCanvas, 0, 0);
}

function removeBluePixels(canvas) {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 255) {
            data[i + 3] = 0; // Устанавливаем альфа-канал в 0, чтобы сделать пиксель прозрачным
        }
    }

    context.putImageData(imageData, 0, 0);
}

function removeGreenPixels(canvas) {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        if (data[i] === 0 && data[i + 1] === 128 && data[i + 2] === 0) {
            data[i + 3] = 0; // Устанавливаем альфа-канал в 0, чтобы сделать пиксель прозрачным
        }
    }

    context.putImageData(imageData, 0, 0);
}

function generateBiomeCenters(canvas, randomGenerator, numCenters) {
    const context = canvas.getContext("2d");
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const centers = [];

    while (centers.length < numCenters) {
        const x = Math.floor(randomGenerator.next() * canvas.width);
        const y = Math.floor(randomGenerator.next() * canvas.height);
        const index = (y * canvas.width + x) * 4;

        if (data[index] === 0 && data[index + 1] === 128 && data[index + 2] === 0) { // Если пиксель зелёный
            centers.push({ x, y });
        }
    }

    return centers;
}

function drawVoronoi(canvas, centers, biomes) {
    const context = canvas.getContext("2d");
    const voronoi = d3.voronoi().extent([[0, 0], [canvas.width, canvas.height]]);
    
    // Преобразуем массив объектов в массив точек
    const points = centers.map(center => [center.x, center.y]);
    const diagram = voronoi(points);

    diagram.polygons().forEach((polygon, i) => {
        if (polygon) {
            context.beginPath();
            context.moveTo(polygon[0][0], polygon[0][1]);
            for (let j = 1; j < polygon.length; j++) {
                context.lineTo(polygon[j][0], polygon[j][1]);
            }
            context.closePath();
            const biome = biomes[i % biomes.length];
            context.fillStyle = biome.color;
            context.fill();
        }
    });
}

function addVoronoiBiomes(canvas, randomGenerator, numCenters) {
    const centers = generateBiomeCenters(canvas, randomGenerator, numCenters * 10); // Увеличиваем количество центров для более детализированной диаграммы
    drawVoronoi(canvas, centers, biomes);
}

function smoothBiomeBorders(canvas, radius) {
    const context = canvas.getContext("2d");
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    const isDifferentBiome = (index1, index2) => {
        return data[index1] !== data[index2] || data[index1 + 1] !== data[index2 + 1] || data[index1 + 2] !== data[index2 + 2];
    };

    const getAverageColor = (x, y, radius) => {
        let r = 0, g = 0, b = 0, count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const index = (ny * width + nx) * 4;
                    r += data[index];
                    g += data[index + 1];
                    b += data[index + 2];
                    count++;
                }
            }
        }
        return [r / count, g / count, b / count];
    };

    const newData = new Uint8ClampedArray(data);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const index = (y * width + x) * 4;
            const neighbors = [
                ((y - 1) * width + x) * 4,
                ((y + 1) * width + x) * 4,
                (y * width + (x - 1)) * 4,
                (y * width + (x + 1)) * 4
            ];

            let differentBiome = false;
            for (const nIndex of neighbors) {
                if (isDifferentBiome(index, nIndex)) {
                    differentBiome = true;
                    break;
                }
            }

            if (differentBiome) {
                const [avgR, avgG, avgB] = getAverageColor(x, y, radius);
                newData[index] = avgR;
                newData[index + 1] = avgG;
                newData[index + 2] = avgB;
                newData[index + 3] = 255;
            }
        }
    }

    context.putImageData(new ImageData(newData, width, height), 0, 0);
}

function checkAndAddGreenPixels(canvas, context) {
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let allBlue = true;

    // Проверка, являются ли все пиксели синими
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] !== 0 || data[i + 1] !== 0 || data[i + 2] !== 255) {
            allBlue = false;
            break;
        }
    }

    if (allBlue) {
        // Если все пиксели синие, добавляем два зеленых пикселя в случайные места
        for (let i = 0; i < 2; i++) {
            const x = Math.floor(randomGenerator.next() * canvas.width);
            const y = Math.floor(randomGenerator.next() * canvas.height);

            // Зеленый пиксель
            context.fillStyle = "green";
            context.fillRect(x, y, 1, 1);
        }
    }
}

function upscaleCanvas(sourceCanvas, targetCanvas, scaleFactor) {
    const gpu = new GPU.GPU();

    const upscaleKernel = gpu.createKernel(function(imageData, sourceWidth, scaleFactor) {
        const x = Math.floor(this.thread.x / scaleFactor);
        const y = Math.floor(this.thread.y / scaleFactor);
        const index = (y * sourceWidth + x) * 4;
        const r = imageData[index] / 255;
        const g = imageData[index + 1] / 255;
        const b = imageData[index + 2] / 255;
        const a = imageData[index + 3] / 255;
        this.color(r, g, b, a);
    })
    .setOutput([sourceCanvas.width * scaleFactor, sourceCanvas.height * scaleFactor])
    .setGraphical(true)
    .setConstants({ sourceWidth: sourceCanvas.width });

    const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);

    upscaleKernel(imageData.data, sourceCanvas.width, scaleFactor);

    const targetCtx = targetCanvas.getContext("2d");
    targetCanvas.width = sourceCanvas.width * scaleFactor;
    targetCanvas.height = sourceCanvas.height * scaleFactor;

    const gpuCanvas = upscaleKernel.canvas;
    targetCtx.setTransform(1, 0, 0, -1, 0, targetCanvas.height);
    targetCtx.drawImage(gpuCanvas, 0, 0);

    gpu.destroy();
}

function addIslands(sourceCanvas, count) {
    for (let i = 0; i < count; i++){    
        const context = sourceCanvas.getContext("2d");
        const changedPixels = new Array(sourceCanvas.width * sourceCanvas.height).fill(false);

        for (let x = 1; x < sourceCanvas.width; x++) {
            for (let y = 1; y < sourceCanvas.height; y++) {
                // Получение индекса текущего пикселя
                const pixelIndex = y * sourceCanvas.width + x;

                // Проверка, был ли пиксель уже изменен
                if (!changedPixels[pixelIndex]) {
                    // Получение данных цвета пикселя
                    const imageData = context.getImageData(x, y, 1, 1);
                    const pixelData = imageData.data;

                    // Проверка зеленого компонента цвета
                    if (pixelData[1] !== 0) {
                        for (let x1 = x - 1; x1 <= x + 1; x1++) {
                            for (let y1 = y - 1; y1 <= y + 1; y1++) {
                                const changeIndex = y1 * sourceCanvas.width + x1;

                                // Проверка, был ли пиксель уже изменен
                                if (!changedPixels[changeIndex]) {
                                    const changeData = context.getImageData(x1, y1, 1, 1);

                                    // Зеленый компонент = 128, синий = 255
                                    if (Math.floor(Math.floor(randomGenerator.next() * 9)) == 0) {
                                        if (changeData.data[2] == 0) {
                                            changeData.data[2] = 255;
                                            changeData.data[1] = 0;
                                        } else {
                                            changeData.data[1] = 128;
                                            changeData.data[2] = 0;
                            
                                            // Устанавливаем метку, что пиксель был изменен
                                            changedPixels[changeIndex] = true;
                                        }

                                        // Обновление данных цвета на холсте
                                        context.putImageData(changeData, x1, y1);
                                    }
                                }
                            }
                        }

                        // Устанавливаем метку, что исходный пиксель был изменен
                        //changedPixels[pixelIndex] = true;
                        // Обновление данных цвета на холсте для исходного пикселя
                        context.putImageData(imageData, x, y);
                    }
                }
            }
        }
    }
}

function generateNoiseMapGreen(canvas, randomGenerator, noiseScale) {
    const context = canvas.getContext("2d");

    for (let x = 0; x < canvas.width; x++) {
        for (let y = 0; y < canvas.height; y++) {
            const noiseValue = randomGenerator.next();
            const alpha = noiseValue > noiseScale ? 0 : 1; 
            context.fillStyle = `rgba(0, 128, 0, ${alpha})`;
            context.fillRect(x, y, 1, 1);
        }
    }
}

function drawWaterWithWaves(canvas) {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const width = canvas.width;
    const height = canvas.height;

    // Получаем данные изображения
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Задаем градиент воды
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#6DAAD0');  // светлый цвет воды
    gradient.addColorStop(1, '#4B89AC');  // темный цвет воды

    // Заливаем градиентом
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    // Перерисовываем только пиксели воды
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];

            // Если пиксель синий (вода)
            if (r === 0 && g === 0 && b === 255) {
                // Добавляем волны
                const waveHeight = Math.sin(x * 0.1 + y * 0.1) * 10;
                const newB = Math.max(0, Math.min(255, 255 - waveHeight));
                data[index] = 0;
                data[index + 1] = 0;
                data[index + 2] = newB;
            }
        }
    }

    // Обновляем данные изображения
    context.putImageData(imageData, 0, 0);
}

function clickUpscale(event) {
    const sourceCanvas = event.target;
    const targetCanvas = document.getElementById("previewCanvas");
    const scaleFactor = targetCanvas.width / sourceCanvas.width;
    upscaleCanvas(sourceCanvas, targetCanvas, scaleFactor);
}

function processCanvas(sourceCanvas, targetCanvas) {
    targetCanvas.width = sourceCanvas.width;
    targetCanvas.height = sourceCanvas.height;
    const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    const targetCtx = targetCanvas.getContext("2d", { willReadFrequently: true });
    const imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    targetCtx.putImageData(imageData, 0, 0);
}

function replaceBlueWithGreen(canvas, randomGenerator) {
    const context = canvas.getContext("2d");
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Создаем копию данных изображения для анализа соседей
    const copyData = new Uint8ClampedArray(data);

    for (let y = 1; y < canvas.height - 1; y++) {
        for (let x = 1; x < canvas.width - 1; x++) {
            const index = (y * canvas.width + x) * 4;
            const red = copyData[index];
            const green = copyData[index + 1];
            const blue = copyData[index + 2];

            // Проверяем, является ли пиксель синим
            if (red === 0 && green === 0 && blue === 255) {
                let greenNeighbors = 0;

                // Проверяем соседние пиксели
                const neighbors = [
                    ((y - 1) * canvas.width + x),     // верхний
                    ((y + 1) * canvas.width + x),     // нижний
                    (y * canvas.width + (x - 1)),     // левый
                    (y * canvas.width + (x + 1))      // правый
                ];

                for (const neighbor of neighbors) {
                    const nIndex = neighbor * 4;
                    if (copyData[nIndex] === 0 && copyData[nIndex + 1] === 128 && copyData[nIndex + 2] === 0) {
                        greenNeighbors++;
                    }
                }

                if (greenNeighbors >= 1 && randomGenerator.next() < 0.98) {
                    data[index] = 0;
                    data[index + 1] = 128;
                    data[index + 2] = 0;
                    data[index + 3] = 255;
                }
            }
        }
    }

    context.putImageData(imageData, 0, 0);
}

function logPixelColor(canvas, x, y) {
    const context = canvas.getContext("2d");
    const imageData = context.getImageData(x, y, 1, 1).data;
    console.log(`Pixel at (${x}, ${y}): R=${imageData[0]}, G=${imageData[1]}, B=${imageData[2]}, A=${imageData[3]}`);
}

function initializeCanvases() {
    const canvasIds = [
        "firstLayerCanvas", "secondLayerCanvas", "thirdLayerCanvas",
        "fourthLayerCanvas", "fifthLayerCanvas", "sixthLayerCanvas",
        "seventhLayerCanvas", "eighthLayerCanvas", "ninthLayerCanvas",
        "waterCanvas", "landCanvas", "voronoiCanvas", "biomeCanvas",
        "smoothCanvas", "extraLayerCanvas"
    ];

    return canvasIds.map(id => {
        const canvas = document.getElementById(id);
        canvas.addEventListener("click", clickUpscale);
        return canvas;
    });
}

function generateStages(randomGenerator, canvases) {
    const [
        firstLayerCanvas, secondLayerCanvas, thirdLayerCanvas,
        fourthLayerCanvas, fifthLayerCanvas, sixthLayerCanvas,
        seventhLayerCanvas, eighthLayerCanvas, ninthLayerCanvas,
        waterCanvas, landCanvas, voronoiCanvas, biomeCanvas,
        smoothCanvas, extraLayerCanvas
    ] = canvases;

    const firstLayerCtx = firstLayerCanvas.getContext("2d", { willReadFrequently: true });
    const secondLayerCtx = secondLayerCanvas.getContext("2d", { willReadFrequently: true });
    const thirdLayerCtx = thirdLayerCanvas.getContext("2d", { willReadFrequently: true });
    const extraLayerCtx = extraLayerCanvas.getContext("2d", { willReadFrequently: true });
    const fourthLayerCtx = fourthLayerCanvas.getContext("2d", { willReadFrequently: true });
    const fifthLayerCtx = fifthLayerCanvas.getContext("2d", { willReadFrequently: true });
    const sixthLayerCtx = sixthLayerCanvas.getContext("2d", { willReadFrequently: true });
    const seventhLayerCtx = seventhLayerCanvas.getContext("2d", { willReadFrequently: true });
    const eighthLayerCtx = eighthLayerCanvas.getContext("2d", { willReadFrequently: true });
    const ninthLayerCtx = ninthLayerCanvas.getContext("2d", { willReadFrequently: true });
    const waterCtx = waterCanvas.getContext('2d', { willReadFrequently: true });
    const landCtx = landCanvas.getContext('2d', { willReadFrequently: true });
    const voronoiCtx = voronoiCanvas.getContext('2d', { willReadFrequently: true });
    const biomeCtx = biomeCanvas.getContext('2d', { willReadFrequently: true });
    const smoothCtx = smoothCanvas.getContext('2d', { willReadFrequently: true });

    const noiseScale = 0.3;
    const scaleFactor = 2;

    return [
        () => {
            firstLayerCtx.fillStyle = "blue";
            firstLayerCtx.fillRect(0, 0, 4, 4);
            processCanvas(firstLayerCanvas, previewCanvas);
            nextStage();
        },
        () => {
            firstLayerCtx.fillStyle = "green";
            for (let x = 0; x < firstLayerCanvas.width; x++) {
                for (let y = 0; y < firstLayerCanvas.height; y++) {
                    if (Math.floor(Math.floor(randomGenerator.next() * 9)) === 0) {
                        firstLayerCtx.fillRect(x, y, 1, 1);
                    }
                }
            }
            processCanvas(firstLayerCanvas, previewCanvas);
            nextStage();
        },
        () => {
            generateNoiseMapGreen(firstLayerCanvas, randomGenerator, noiseScale);
            checkAndAddGreenPixels(firstLayerCanvas, firstLayerCtx);
            upscaleCanvas(firstLayerCanvas, secondLayerCanvas, scaleFactor);
            processCanvas(secondLayerCanvas, previewCanvas);
            nextStage();
        },
        () => {
            addIslands(secondLayerCanvas, 3);
            upscaleCanvas(secondLayerCanvas, extraLayerCanvas, scaleFactor);
            processCanvas(extraLayerCanvas, previewCanvas);
            nextStage();
        },
        () => {
            addIslands(extraLayerCanvas, 3);
            upscaleCanvas(extraLayerCanvas, thirdLayerCanvas, scaleFactor);
            processCanvas(thirdLayerCanvas, previewCanvas);
            nextStage();
        },
        () => {
            addIslands(thirdLayerCanvas, 3);
            upscaleCanvas(thirdLayerCanvas, fourthLayerCanvas, scaleFactor);
            processCanvas(fourthLayerCanvas, previewCanvas);
            nextStage();
        },
        () => {
            addIslands(fourthLayerCanvas, 3);
            upscaleCanvas(fourthLayerCanvas, fifthLayerCanvas, scaleFactor);
            processCanvas(fifthLayerCanvas, previewCanvas);
            nextStage();
        },
        () => {
            addIslands(fifthLayerCanvas, 3);
            upscaleCanvas(fifthLayerCanvas, sixthLayerCanvas, scaleFactor);
            processCanvas(sixthLayerCanvas, previewCanvas);
            nextStage();
        },
        () => {
            addIslands(sixthLayerCanvas, 3);
            upscaleCanvas(sixthLayerCanvas, seventhLayerCanvas, scaleFactor);
            processCanvas(seventhLayerCanvas, previewCanvas);
            nextStage();
        },
        () => {
            addIslands(seventhLayerCanvas, 3);
            upscaleCanvas(seventhLayerCanvas, eighthLayerCanvas, scaleFactor);
            processCanvas(eighthLayerCanvas, previewCanvas);
            nextStage();
        },
        () => {
            replaceBlueWithGreen(eighthLayerCanvas, randomGenerator);
            smoothCtx.drawImage(eighthLayerCanvas, 0, 0);
            landCtx.drawImage(eighthLayerCanvas, 0, 0);
            processCanvas(landCanvas, previewCanvas);
            nextStage();
        },
        () => {
            voronoiCtx.drawImage(landCanvas, 0, 0);
            waterCtx.drawImage(landCanvas, 0, 0);
            removeBluePixels(landCanvas);
            removeGreenPixels(waterCanvas);
            drawWaterWithWaves(waterCanvas);
            processCanvas(waterCanvas, previewCanvas);
            nextStage();
        },
        () => {
            addVoronoiBiomes(voronoiCanvas, randomGenerator, 100);
            biomeCtx.drawImage(voronoiCanvas, 0, 0);
            biomeCtx.drawImage(waterCanvas, 0, 0);
            smoothBiomeBorders(biomeCanvas, 0);
            removeBluePixels(biomeCanvas);
            processCanvas(biomeCanvas, previewCanvas);
            nextStage();
        },
        () => {
            ninthLayerCtx.drawImage(eighthLayerCanvas, 0, 0);
            ninthLayerCtx.drawImage(biomeCanvas, 0, 0);
            processCanvas(ninthLayerCanvas, previewCanvas);
            nextStage();
        },
        () => {
            upscaleCanvas(ninthLayerCanvas, previewCanvas, scaleFactor);
            processCanvas(ninthLayerCanvas, previewCanvas);
            nextStage();
        }
    ];
}

function nextStage() {
    if (stages.length > 0) {
        const stage = stages.shift();
        setTimeout(stage, 100); // Используем setTimeout для отображения каждого слоя
    } else {
        setControlsState(true); // Enable controls after all stages are done
    }
}


function setControlsState(enabled) {
    const controls = document.querySelectorAll('.header button, .header input[type="text"], .header label.button');
    controls.forEach(control => {
        control.disabled = !enabled;
        if (control.tagName === 'LABEL') {
            if (enabled) {
                control.classList.remove('disabled');
            } else {
                control.classList.add('disabled');
            }
        }
    });
}

function generateNewMap(seed = null) {
    setControlsState(false);
    if (!seed) {
        seed = Math.floor(Math.random() * 1e16);
    }
    randomGenerator = new seededRandomGenerator(seed);
    document.getElementById('seedInput').value = seed;
    stages = generateStages(randomGenerator, canvases);
    nextStage();
}

function generateMapFromSeed() {
    const seed = parseInt(document.getElementById('seedInput').value, 10);
    if (!isNaN(seed)) {
        generateNewMap(seed);
    } else {
        alert('Invalid seed. Please enter a valid number.');
    }
}

function viewStages() {
    const hiddenCanvases = document.querySelector(".hidden-canvases");
    hiddenCanvases.style.display = hiddenCanvases.style.display === "none" ? "block" : "none";
    hiddenCanvases.scrollIntoView({ behavior: 'smooth' });
}

function saveCanvasWithSeed(canvas, seed, format = 'png') {
    const context = canvas.getContext('2d');
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Преобразование сида в бинарный формат
    const binarySeed = seed.toString(2).padStart(64, '0');

    // Встраивание бинарного сида в альфа-канал первых 64 пикселей
    for (let i = 0; i < 64; i++) {
        const bit = binarySeed[i] === '1' ? 1 : 0;
        data[i * 4 + 3] = (data[i * 4 + 3] & 0xFE) | bit;  // Изменяем альфа-канал
    }

    // Обновление данных изображения
    context.putImageData(imageData, 0, 0);

    // Сохранение изображения
    const link = document.createElement('a');
    link.href = canvas.toDataURL(`image/${format}`);
    link.download = `map.${format}`;
    link.click();
}

function extractSeedFromImage(canvas) {
    const context = canvas.getContext('2d');
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let binarySeed = '';
    for (let i = 0; i < 64; i++) {
        const bit = data[i * 4 + 3] & 1;  // Читаем из альфа-канала
        binarySeed += bit.toString();
    }

    if (binarySeed.length !== 64) return null;

    const seed = parseInt(binarySeed, 2);
    return isNaN(seed) ? null : seed;
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const context = canvas.getContext('2d');
            context.drawImage(img, 0, 0);

            const seed = extractSeedFromImage(canvas);
            if (seed !== null) {
                document.getElementById('seedInput').value = seed;
                generateNewMap(seed);
            } else {
                alert('No valid seed found in the image.');
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

const previewCanvas = document.getElementById("previewCanvas");
let stages = [];
const canvases = initializeCanvases();

document.getElementById("generateButton").addEventListener("click", () => generateNewMap());
document.getElementById("generateSeedButton").addEventListener("click", generateMapFromSeed);
document.getElementById("viewStagesButton").addEventListener("click", viewStages);
document.getElementById('loadButton').addEventListener('change', handleImageUpload);
document.getElementById("saveButton").addEventListener("click", () => {
    const seed = parseInt(document.getElementById('seedInput').value, 10);
    saveCanvasWithSeed(previewCanvas, seed);
});

generateNewMap();
const http = require('http');
const fs = require("fs").promises;
const superagent = require('superagent');
const { program } = require('commander');

program
    .requiredOption('-h, --host <host>', 'address of the server')
    .requiredOption('-p, --port <port>', 'port of the server')
    .requiredOption('-c, --cache <path>', 'path to the cache directory');

program.parse();
const { host, port, cache } = program.opts();

// Перевірка та створення директорії для кешу, якщо її не існує
fs.mkdir(cache, { recursive: true })
    .then(() => {
        console.log(`Cache directory is ready: ${cache}`);
    })
    .catch(err => {
        console.error(`Failed to create cache directory: ${err}`);
        process.exit(1);
    });

const server = http.createServer((req, res) => {
    console.log(`Received request: ${req.method} ${req.url}`);
    const statusCode = req.url.slice(1);
    const filePath = `${cache}/${statusCode}.jpg`;

    if (req.method === 'PUT') {
        console.log(`Processing PUT request for status code: ${statusCode}`);

        let body = [];
        req.on('data', chunk => body.push(chunk));
        req.on('end', () => {
            body = Buffer.concat(body);

            if (!body.length) {
                res.writeHead(400, {'Content-Type': 'text/plain'});
                res.end('No image in request body');
                return;
            }

            console.log(`Saving image to: ${filePath}`);

            fs.writeFile(filePath, body)
                .then(() => {
                    res.writeHead(201, {'Content-Type': 'text/plain'});
                    res.end('Image saved');
                })
                .catch(err => {
                    console.log(`Error saving image: ${err}`);
                    res.writeHead(500, {'Content-Type': 'text/plain'});
                    res.end('Internal Server Error');
                });
        })
    } else if (req.method === 'GET') {
        console.log(`Processing GET request for status code: ${statusCode}`);

        fs.readFile(filePath)
            .then(image => {
                res.writeHead(200, {'Content-Type': 'image/jpeg'});
                res.end(image);
            })
            .catch (err => {
                console.log(`Image not found in cache, fetching from http.cat`);

                superagent.get(`https://http.cat/${statusCode}`)
                    .buffer(true) // важливо додати .buffer() для отримання бінарних даних
                    .then(response => {
                        const image = response.body; // Тепер це Buffer
                        return fs.writeFile(filePath, image)
                            .then(() => {
                                res.writeHead(200, {'Content-Type': 'image/jpeg'});
                                res.end(image);
                            });
                    })
                    .catch(err => {
                        console.log(`Failed to fetch from http.cat: ${err}`);
                        res.writeHead(404, {'Content-Type': 'text/plain'});
                        res.end('Image not found');
                    });
            });
    } else if (req.method === 'DELETE') {
        console.log(`Processing DELETE request for status code: ${statusCode}`);

        fs.unlink(filePath)
            .then(() => {
                res.writeHead(200, {'Content-Type': 'text/plain'});
                res.end('Image deleted');
            })
            .catch(err => {
                console.log(`Delete failed ${err}`);
                res.writeHead(404, {'Content-Type': 'text/plain'});
                res.end('Image not found');
            });
    } else {
        res.writeHead(405, {'Content-Type': 'text/plain'});
        res.end('Method not allowed');
    }
});

server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
});

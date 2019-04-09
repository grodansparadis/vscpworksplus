{
    "targets": [{
        "target_name": "vscphelper",
        "sources": [
            "./src/vscphelper.c"
        ],
    "cflags!":['-fno-exceptions'],
    "cflags_cc!":['-fno-exceptions'],
    "include_dirs":["<!@(node -p \"require('node-addon-api').include\")"],
    "dependencies":["<!(node -p \"require('node-addon-api').gyp\")"],
    }]
}
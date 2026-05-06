<?php
session_start();

header("Content-Type: application/json; charset=utf-8");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    echo json_encode([
        "ok" => false,
        "mensaje" => "Este endpoint debe llamarse con POST desde checkout.js, no abrirse directo en el navegador."
    ]);
    exit;
}

$rawInput = file_get_contents("php://input");
$input = json_decode($rawInput, true);

if (!$input || !is_array($input)) {
    echo json_encode([
        "ok" => false,
        "mensaje" => "Datos inválidos. No llegó JSON válido.",
        "debug_raw" => $rawInput
    ]);
    exit;
}

$total = intval($input["total"] ?? 0);
$totalEnCentavos = intval($input["total_en_centavos"] ?? 0);
$moneda = $input["moneda"] ?? "COP";
$referenciaPago = $input["referencia_pago"] ?? "";

if ($total <= 0 && $totalEnCentavos <= 0) {
    echo json_encode([
        "ok" => false,
        "mensaje" => "Total inválido.",
        "debug_input" => $input
    ]);
    exit;
}

if ($totalEnCentavos <= 0) {
    $totalEnCentavos = $total * 100;
}

if (!$referenciaPago) {
    $referenciaPago = "SSJ-" . date("Ymd-His") . "-" . rand(1000, 9999);
}

/*
    IMPORTANTE:
    Reemplaza estos valores por los de tu cuenta Wompi sandbox.
*/
$publicKey = "pub_test_TU_LLAVE_PUBLICA";
$integritySecret = "test_integrity_TU_SECRETO";

if ($publicKey === "pub_test_TU_LLAVE_PUBLICA" || $integritySecret === "test_integrity_TU_SECRETO") {
    echo json_encode([
        "ok" => false,
        "mensaje" => "Debes configurar tu llave pública y secreto de integridad de Wompi sandbox en wompi_crear_pago.php."
    ]);
    exit;
}

$signature = hash(
    "sha256",
    $referenciaPago . $totalEnCentavos . $moneda . $integritySecret
);

/*
    Cambia esta URL por la URL real de tu proyecto.
    En local puede ser algo como:
    http://localhost/tu-carpeta/checkout.html
*/
$redirectUrl = "http://localhost/tiendasuperwao/store-super-joven/checkout.html";

$checkoutUrl = "https://checkout.wompi.co/p/?" . http_build_query([
    "public-key" => $publicKey,
    "currency" => $moneda,
    "amount-in-cents" => $totalEnCentavos,
    "reference" => $referenciaPago,
    "signature:integrity" => $signature,
    "redirect-url" => $redirectUrl
]);

echo json_encode([
    "ok" => true,
    "checkout_url" => $checkoutUrl,
    "referencia_pago" => $referenciaPago,
    "total_en_centavos" => $totalEnCentavos,
    "moneda" => $moneda
]);
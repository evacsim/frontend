<?php
header("Content-Type:application/json; charset=utf-8");
$json_string = file_get_contents('php://input'); ##今回のキモ

//echo $json_string;
$obj = json_decode($json_string);
//$obj['step_count'] =  140;
//$obj['total_count'] = 215;
//$obj['cars_length'] =  14;
//$f = fopen("out/out".$obj['cars_length'].".csv","w");
$f = fopen("./out.csv","a");

$t = '';


//$obj['test'] = 'hoge';
//$obj['test2'] = 'fuga';
//$obj['chin'] = 'man';
foreach($obj as $key => $value){
//	print "$key , $value\n";
	$t .= "$key,$value\n";
}


if (fwrite($f,$t) == FALSE) {
	$status = '失敗';
} else {
	$status = '成功';
}

$out['status_msg'] = $status;


echo json_encode($out);


fclose($f);

//var_dump($obj);



?>

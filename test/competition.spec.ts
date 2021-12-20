import rawBRE from 'hardhat';
import BigNumber from 'bignumber.js';

import {
  deployBendCompetition,
  deployCryptoPunksMarket,
  deployMintableERC20,
  deployMintableERC721,
} from '../helpers/contracts-deployments';
import { DRE, waitForTx } from '../helpers/misc-utils';
import {
  BendCompetition,
  CryptoPunksMarket,
  MintableERC20,
  MintableERC721,
} from '../types';
import {
  getEthersSigners,
  getSecondSigner,
} from '../helpers/contracts-getters';
import { expect } from 'chai';
import { ZERO_ADDRESS } from '../helpers/constants';

describe('Competition', async () => {
  const oneBend = new BigNumber(1).shiftedBy(18);
  const oneETH = new BigNumber(1).shiftedBy(18);

  before(async () => {
    BigNumber.config({
      DECIMAL_PLACES: 0,
      ROUNDING_MODE: BigNumber.ROUND_DOWN,
    });

    await rawBRE.run('set-DRE');
  });

  it('should claim with erc721', async () => {
    const [firstSigner, secondSigner] = await getEthersSigners();

    const bendToken = await deployMintableERC20(['BendToken', 'BEND', '18']);
    const erc721Token = await deployMintableERC721(['ERC721 Token', 'NFT']);

    const bendCompetition = await deployBendCompetition([
      '0',
      '999999999',
      bendToken.address,
      '0',
      ZERO_ADDRESS,
      [erc721Token.address],
      oneBend.div(2).toFixed(0),
      oneETH.toFixed(0),
    ]);

    await waitForTx(await bendToken.mint(oneBend.toFixed(0)));
    await waitForTx(
      await bendToken.transfer(bendCompetition.address, oneBend.toFixed(0))
    );

    let [competitionBalance, secondSignerBalane] = await Promise.all([
      bendToken.balanceOf(bendCompetition.address),
      bendToken.balanceOf(await secondSigner.getAddress()),
    ]);
    expect(competitionBalance.toString()).to.equal(oneBend.toFixed(0));
    expect(secondSignerBalane.toString()).to.equal('0');

    await waitForTx(await erc721Token.connect(secondSigner).mint(1));

    await waitForTx(
      await bendCompetition.connect(secondSigner).claimWithERC721({
        value: oneETH.toFixed(0),
      })
    );

    [competitionBalance, secondSignerBalane] = await Promise.all([
      bendToken.balanceOf(bendCompetition.address),
      bendToken.balanceOf(await secondSigner.getAddress()),
    ]);

    expect(competitionBalance.toString()).to.equal(oneBend.div(2).toFixed(0));
    expect(secondSignerBalane.toString()).to.equal(oneBend.div(2).toFixed(0));
  });

  it('should claim crypto punks', async () => {
    const [firstSigner, secondSigner] = await getEthersSigners();

    const bendToken = await deployMintableERC20(['BendToken', 'BEND', '18']);
    const cryptoPunksMarket = await deployCryptoPunksMarket([]);
    await waitForTx(await cryptoPunksMarket.allInitialOwnersAssigned());

    const bendCompetition = await deployBendCompetition([
      '0',
      '999999999',
      bendToken.address,
      '0',
      cryptoPunksMarket.address,
      [],
      oneBend.div(4).toFixed(0),
      oneETH.toFixed(0),
    ]);

    await waitForTx(await bendToken.mint(oneBend.toFixed(0)));
    await waitForTx(
      await bendToken.transfer(bendCompetition.address, oneBend.toFixed(0))
    );

    let [competitionBalance, secondSignerBalane] = await Promise.all([
      bendToken.balanceOf(bendCompetition.address),
      bendToken.balanceOf(await secondSigner.getAddress()),
    ]);
    expect(competitionBalance.toString()).to.equal(oneBend.toFixed(0));
    expect(secondSignerBalane.toString()).to.equal('0');

    await waitForTx(await cryptoPunksMarket.connect(secondSigner).getPunk(1));
    await waitForTx(await cryptoPunksMarket.connect(secondSigner).getPunk(2));

    await waitForTx(
      await bendCompetition.connect(secondSigner).claimWithCryptoPunks([1, 2], {
        value: oneETH.multipliedBy(2).toFixed(0),
      })
    );

    [competitionBalance, secondSignerBalane] = await Promise.all([
      bendToken.balanceOf(bendCompetition.address),
      bendToken.balanceOf(await secondSigner.getAddress()),
    ]);
    expect(competitionBalance.toString()).to.equal(oneBend.div(2).toFixed(0));
    expect(secondSignerBalane.toString()).to.equal(oneBend.div(2).toFixed(0));
  });

  it('should claim with eth', async () => {
    const [firstSigner, secondSigner, thirdSigner] = await getEthersSigners();

    const bendToken = await deployMintableERC20(['BendToken', 'BEND', '18']);
    const erc721Token = await deployMintableERC721(['ERC721 Token', 'NFT']);

    const bendCompetition = await deployBendCompetition([
      '0',
      '99999999',
      bendToken.address,
      oneBend.div(1000).toFixed(0),
      ZERO_ADDRESS,
      [erc721Token.address],
      oneBend.div(1000).toFixed(0),
      oneETH.multipliedBy(100).toFixed(0),
    ]);

    await waitForTx(await bendToken.mint(oneBend.toFixed(0)));
    await waitForTx(
      await bendToken.transfer(bendCompetition.address, oneBend.toFixed(0))
    );

    let [
      maxETHPaymentForNFT,
      maxETHPaymentForETH,
      competitionBalance,
      secondSignerBalane,
      thirdSignerBalance,
    ] = await Promise.all([
      bendCompetition.MAX_ETH_PAYMENT_FOR_NFT(),
      bendCompetition.MAX_ETH_PAYMENT_FOR_ETH(),
      bendToken.balanceOf(bendCompetition.address),
      bendToken.balanceOf(await secondSigner.getAddress()),
      bendToken.balanceOf(await thirdSigner.getAddress()),
    ]);

    expect(maxETHPaymentForNFT.toString()).to.equal(
      oneETH.multipliedBy(5000).toFixed(0)
    );
    expect(maxETHPaymentForETH.toString()).to.equal('0');
    expect(competitionBalance.toString()).to.equal(oneBend.toFixed(0));
    expect(secondSignerBalane.toString()).to.equal('0');
    expect(thirdSignerBalance.toString()).to.equal('0');

    await waitForTx(await erc721Token.connect(secondSigner).mint(1));
    await waitForTx(
      await bendCompetition.connect(secondSigner).claimWithERC721({
        value: oneETH.toFixed(0),
      })
    );

    [
      maxETHPaymentForNFT,
      maxETHPaymentForETH,
      competitionBalance,
      secondSignerBalane,
      thirdSignerBalance,
    ] = await Promise.all([
      bendCompetition.MAX_ETH_PAYMENT_FOR_NFT(),
      bendCompetition.MAX_ETH_PAYMENT_FOR_ETH(),
      bendToken.balanceOf(bendCompetition.address),
      bendToken.balanceOf(await secondSigner.getAddress()),
      bendToken.balanceOf(await thirdSigner.getAddress()),
    ]);

    expect(maxETHPaymentForNFT.toString()).to.equal(
      oneETH.multipliedBy(4999).toFixed(0)
    );
    expect(maxETHPaymentForETH.toString()).to.equal('0');
    expect(competitionBalance.toString()).to.equal(
      oneBend.multipliedBy(999 / 1000).toFixed(0)
    );
    expect(secondSignerBalane.toString()).to.equal(
      oneBend.multipliedBy(1 / 1000).toFixed(0)
    );
    expect(thirdSignerBalance.toString()).to.equal('0');

    await waitForTx(
      await bendCompetition.connect(secondSigner).claimWithERC721({
        value: oneETH.multipliedBy(99).toFixed(0),
      })
    );

    [
      maxETHPaymentForNFT,
      maxETHPaymentForETH,
      competitionBalance,
      secondSignerBalane,
      thirdSignerBalance,
    ] = await Promise.all([
      bendCompetition.MAX_ETH_PAYMENT_FOR_NFT(),
      bendCompetition.MAX_ETH_PAYMENT_FOR_ETH(),
      bendToken.balanceOf(bendCompetition.address),
      bendToken.balanceOf(await secondSigner.getAddress()),
      bendToken.balanceOf(await thirdSigner.getAddress()),
    ]);

    expect(maxETHPaymentForNFT.toString()).to.equal(
      oneETH.multipliedBy(4900).toFixed(0)
    );
    expect(maxETHPaymentForETH.toString()).to.equal(
      oneETH.multipliedBy(10).toFixed(0)
    );
    expect(competitionBalance.toString()).to.equal(
      oneBend.multipliedBy(900 / 1000).toFixed(0)
    );
    expect(secondSignerBalane.toString()).to.equal(
      oneBend.multipliedBy(100 / 1000).toFixed(0)
    );
    expect(thirdSignerBalance.toString()).to.equal('0');

    await waitForTx(
      await bendCompetition.connect(thirdSigner).claimWithETH({
        value: new BigNumber(1).shiftedBy(18).toFixed(0),
      })
    );

    [
      maxETHPaymentForNFT,
      maxETHPaymentForETH,
      competitionBalance,
      secondSignerBalane,
      thirdSignerBalance,
    ] = await Promise.all([
      bendCompetition.MAX_ETH_PAYMENT_FOR_NFT(),
      bendCompetition.MAX_ETH_PAYMENT_FOR_ETH(),
      bendToken.balanceOf(bendCompetition.address),
      bendToken.balanceOf(await secondSigner.getAddress()),
      bendToken.balanceOf(await thirdSigner.getAddress()),
    ]);

    expect(maxETHPaymentForNFT.toString()).to.equal(
      oneETH.multipliedBy(4899).toFixed(0)
    );
    expect(maxETHPaymentForETH.toString()).to.equal(
      oneETH.multipliedBy(9).toFixed(0)
    );
    expect(competitionBalance.toString()).to.equal(
      oneBend.multipliedBy(899 / 1000).toFixed(0)
    );
    expect(secondSignerBalane.toString()).to.equal(
      oneBend.multipliedBy(100 / 1000).toFixed(0)
    );
    expect(thirdSignerBalance.toString()).to.equal(
      oneBend.multipliedBy(1 / 1000).toFixed(0)
    );
  });
});
